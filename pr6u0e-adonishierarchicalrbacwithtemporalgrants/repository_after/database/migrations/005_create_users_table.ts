// @ts-nocheck
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email').notNullable().unique()
      table.string('password').notNullable()
      table.string('full_name').notNullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.timestamps(true)

      table.index(['tenant_id'])
      table.index(['email'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}