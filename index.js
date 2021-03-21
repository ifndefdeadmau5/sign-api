const { ApolloServer, gql } = require("apollo-server");
const { Client } = require("pg");

const client = new Client({
  connectionString:
    process.env.DATABASE_URL || "postgresql://alucard@localhost:5432/alucard",
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect();

const typeDefs = gql`
  type Survey {
    id: ID
    name: String!
    result: String!
    signatureDataUrl: String!
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
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen(process.env.PORT || 4000).then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
