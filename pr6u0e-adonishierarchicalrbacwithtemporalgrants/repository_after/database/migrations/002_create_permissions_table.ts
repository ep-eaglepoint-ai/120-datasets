// @ts-nocheck
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.timestamps(true)

      // Ensure permission names are unique within a tenant
      table.unique(['name', 'tenant_id'])
      table.index(['tenant_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}