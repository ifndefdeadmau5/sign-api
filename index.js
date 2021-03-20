const { ApolloServer, gql } = require("apollo-server");

const typeDefs = gql`
  type Book {
    title: String
    author: String
  }

  type User {
    id: ID
    email: String
    password: String
  }

  type Query {
    books: [Book]
  }
`;
const books = [
  {
    title: "The Awakening",
    author: "Kate Chopin",
  },
  {
    title: "City of Glass",
    author: "Paul Auster",
  },
];

const resolvers = {
  Query: {
    books: () => books,
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen(process.env.PORT || 4000).then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
