const { buildSchema } = require("graphql");

// ?: The '!' mark in the schema indicates that it is a required field
// ?: In graphql, you can query only what is necessary so we can return extra stuff in the resolvers

// ? eg: to get user data in various parts of the front end, just query 1 endpoint to get all the user data. Front end can decide what to get in diff uses

module.exports = buildSchema(`
  type Post {
    _id: ID!
    title: String!
    content: String!
    imageUrl: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    name: String!
    email: String!
    password: String!
    status: String!
    posts: [Post!]!
  }

  type AuthData {
    token: String!
    userId: String!
  }

  type PostData {
    posts: [Post!]!
    totalPosts: Int!
  }

  input UserInputData {
    email: String!
    name: String!
    password: String!
  }

  input PostInputData {
    title: String!
    imageUrl: String!
    content: String!
  }

  type RootMutation {
    createUser(userInput: UserInputData): User!
    createPost(postInput: PostInputData): Post!
    updatePost(id: ID!, postInput: PostInputData): Post!
    deletePost(id: ID!): Boolean!
    updateStatus(status: String!): User!
  }

  type RootQuery {
    login(email: String!, password: String!): AuthData!
    posts(page: Int): PostData!
    post(id: ID!): Post!
    user: User!
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`);
