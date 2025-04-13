const { ApolloServer } = require('apollo-server');
const { Neo4jGraphQL } = require('@neo4j/graphql');
require('dotenv').config();
const neo4j = require('neo4j-driver');

const typeDefs = `
  type Characters @node {
    id: ID! @id
    name: String!
    height: Int
    mass: Int
    skin_colors: String
    hair_colors: String
    eye_colors: String
    birth_year: String
    gender: String
    homeworld: [Planets!]! @relationship(type: "FROM", direction: OUT)
    species: [Species!]! @relationship(type: "IDENTIFIES_AS", direction: OUT)
  }

  type Planets @node {
    id: ID! @id
    name: String!
    climate: String
    terrain: String
    characters: [Characters!]! @relationship(type: "FROM", direction: IN)
  }

  type Species @node {
    id: ID! @id
    name: String!
    classification: String
    language: String
    characters: [Characters!]! @relationship(type: "IDENTIFIES_AS", direction: IN)
  }

  type Mutation {
    updateCharacter(name: String!, mass: Int, gender: String, birth_year: String): Characters
  }
`;

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const resolvers = {
  Mutation: {
    updateCharacter: async (_, args, context) => {
      const { name, mass, gender, birth_year } = args;

      const query = `
        MATCH (character:Characters {name: $name})
        SET character.mass = $mass,
            character.gender = $gender,
            character.birth_year = $birth_year
        RETURN character
      `;
      console.log('Received args:', args);

      const params = {
        name,
        mass,
        gender,
        birth_year
      };

      const session = context.driver.session();
      try {
        const result = await session.run(query, params);
        const record = result.records[0];
        session.close();

        if (record) {
          return record.get('character').properties;
        } else {
          return null;
        }
      } catch (error) {
        console.error('Mutation error:', error);
        throw new Error('Failed to update character');
      }
    }
  }
};

const neoSchema = new Neo4jGraphQL({ typeDefs, resolvers, driver });

neoSchema.getSchema().then((schema) => {
  const server = new ApolloServer({
    schema,
    context: ({ req }) => ({ driver }) // Make sure driver is available in context
  });

  server.listen().then(({ url }) => {
    console.log(` Server ready at ${url}`);
  });
});