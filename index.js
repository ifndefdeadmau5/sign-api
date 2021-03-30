const express = require("express");
const {
  ApolloServer,
  gql,
  AuthenticationError,
} = require("apollo-server-express");
const jwt = require("express-jwt");
const jsonwebtoken = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const { Client } = require("pg");
const { utcToZonedTime, zonedTimeToUtc } = require("date-fns-tz");
const { startOfDay, endOfDay } = require("date-fns");

function getDateParams(utcDate, timeZone) {
  const timeZoneDate = utcToZonedTime(utcDate, timeZone);
  const start = startOfDay(timeZoneDate);
  const end = endOfDay(timeZoneDate);
  const startUtc = zonedTimeToUtc(start, timeZone);
  const endUtc = zonedTimeToUtc(end, timeZone);

  return [startUtc, endUtc];
}

const app = new express();

app.use(
  jwt({
    secret: process.env.JWT_SECRET,
    credentialsRequired: false,
    algorithms: ["HS256"],
  })
);

app.use(cookieParser());

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

client.connect();

const typeDefs = gql`
  enum SurveyType {
    A
    B
    C
  }

  type Survey {
    id: ID
    type: SurveyType
    doctor: String
    operation: String
    name: String!
    registrationNumber: String!
    gender: String!
    result: String!
    signatureDataUrl: String!
    signedBy: String!
    relationship: String!
    createdAt: String!
  }

  type User {
    id: ID!
    email: String!
    username: String
    password: String!
  }

  type Query {
    surveys(createdAt: String): [Survey!]!
    survey(id: ID!): Survey!
  }

  input SurveyInput {
    name: String!
    type: SurveyType!
    doctor: String
    operation: String
    registrationNumber: String!
    gender: String!
    result: String!
    signatureDataUrl: String!
    signedBy: String!
    relationship: String!
  }

  type Mutation {
    addSurvey(input: SurveyInput!): Survey
    login(email: String!, password: String!): User
    signUp(email: String!, password: String!, username: String): Boolean
  }
`;

const resolvers = {
  Query: {
    surveys: async (_, { createdAt }, { id }) => {
      const [start, end] = getDateParams(createdAt, "Asia/Seoul");
      try {
        const res = await client.query(
          `SELECT * FROM surveys where author = $1 AND "createdAt" BETWEEN $2 AND $3`,
          [id, start, end]
        );
        return res.rows;
      } catch (err) {
        console.log(err.stack);
      }
    },
    survey: async (_, args) => {
      try {
        const res = await client.query("SELECT * FROM surveys where id = $1", [
          args.id,
        ]);
        return res.rows[0];
      } catch (err) {
        console.log(err.stack);
      }
    },
  },
  Mutation: {
    signUp: async (root, { email, password, username = "noname" }, { res }) => {
      const text = `INSERT INTO accounts(email, username, password) VALUES($1, $2, $3) RETURNING *`;
      const values = [email, username, await bcrypt.hash(password, 10)];

      try {
        const result = await client.query(text, values);

        const token = jsonwebtoken.sign(
          {
            id: result.user_id,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        res.cookie("id", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        });
        return true;
      } catch (err) {
        console.log(err.stack);
        return false;
      }
    },
    login: async (root, { email, password }, { res }) => {
      try {
        const result = await client.query(
          "SELECT * FROM accounts where email = $1",
          [email]
        );
        const [user] = result.rows;
        if (!user) {
          throw new Error("No user with that id");
        }

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
          throw new Error("Incorrect password");
        }

        const token = jsonwebtoken.sign(
          {
            id: user.user_id,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        res.cookie("id", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
          sameSite: process.env.NODE_ENV === "production" ? "none" : false,
        });
        return user;
      } catch (err) {
        console.log(err.stack);
        throw new Error(err);
      }
    },
    addSurvey: async (
      root,
      {
        input: {
          name,
          result,
          signatureDataUrl,
          registrationNumber,
          gender,
          signedBy,
          relationship,
          type,
          operation,
          doctor,
        },
      },
      { id }
    ) => {
      const text = `INSERT INTO surveys(name, result, "signatureDataUrl", author, "registrationNumber", gender, "signedBy", relationship, type, operation, doctor) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`;
      const values = [
        name,
        result,
        signatureDataUrl,
        id,
        registrationNumber,
        gender,
        signedBy,
        relationship,
        type,
        operation,
        doctor,
      ];

      try {
        const res = await client.query(text, values);
        return res.rows[0];
      } catch (err) {
        console.log(err.stack);
      }
    },
  },
};

const context = ({ req, res }) => {
  if (req.body.operationName === "SignIn") {
    return { req, res };
  }
  const token = req.cookies["id"] || "";
  try {
    const { id, email } = jsonwebtoken.verify(token, process.env.JWT_SECRET);
    return { req, res, id, email };
  } catch (e) {
    throw new AuthenticationError(
      "Authentication token is invalid, please log in"
    );
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context,
  playground: true,
});

server.applyMiddleware({
  app,
  cors: {
    credentials: true,
    origin: ["http://localhost:3000", "https://sign-app-one.vercel.app"],
  },
});

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
);
