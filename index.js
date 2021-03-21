const { ApolloServer, gql } = require("apollo-server");
const { Client } = require("pg");

const client = new Client({
  connectionString:
    process.env.DATABASE_URL || "postgresql://alucard@localhost:5432/alucard2",
  ssl: {
    rejectUnauthorized: false,
  },
  // Use { ssl: false } in development environment
  // ssl: false,
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
    addSurvey: async (
      root,
      {
        input: {
          name,
          result,
          signatureDataUrl,
          author,
          registrationNumber,
          gender,
          signedBy,
        },
      },
      { models }
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

const server = new ApolloServer({ typeDefs, resolvers });

server.listen(process.env.PORT || 4000).then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
