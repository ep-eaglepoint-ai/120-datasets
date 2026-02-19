// @ts-nocheck
import { defineConfig } from '@adonisjs/lucid'

const databaseConfig = defineConfig({
  connection: 'sqlite',
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: './database/database.sqlite',
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['./database/migrations'],
      },
    },
  },
})

export default databaseConfig