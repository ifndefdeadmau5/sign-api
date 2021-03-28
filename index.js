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
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://bagseongmin@localhost:5432/sign-app-db",
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

client.connect();

const typeDefs = gql`
  type Survey {
    id: ID
    name: String!
    registrationNumber: String!
    gender: String!
    result: String!
    signatureDataUrl: String!
    signedBy: String!
    createdAt: String!
  }

  type User {
    id: ID!
    email: String!
    username: String
    password: String!
  }

  type Query {
    surveys: [Survey!]!
    survey(id: ID!): Survey!
  }

  input SurveyInput {
    name: String!
    registrationNumber: String!
    gender: String!
    result: String!
    signatureDataUrl: String!
    signedBy: String!
  }

  type Mutation {
    addSurvey(input: SurveyInput!): Survey
    login(email: String!, password: String!): User
    signUp(email: String!, password: String!, username: String): Boolean
  }
`;

const resolvers = {
  Query: {
    surveys: async () => {
      try {
        const res = await client.query("SELECT * FROM surveys");
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
        console.log("user");
        console.log(user);
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

        console.log("process.env.NODE_ENV");
        console.log(process.env.NODE_ENV);

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
          // author,
          registrationNumber,
          gender,
          signedBy,
        },
      }
    ) => {
      const text = `INSERT INTO surveys(name, result, "signatureDataUrl", author, "registrationNumber", gender, "signedBy") VALUES($1, $2, $3, 2, $4, $5, $6) RETURNING *`;
      const values = [
        name,
        result,
        signatureDataUrl,
        registrationNumber,
        gender,
        signedBy,
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
