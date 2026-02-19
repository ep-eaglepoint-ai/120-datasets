import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Tenant',
    },
  })

  console.log('Created tenant:', tenant.id)

  const adminPassword = await hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  })

  console.log('Created admin user:', admin.email)

  const viewerPassword = await hash('viewer123', 10)
  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@example.com',
      name: 'Viewer User',
      password: viewerPassword,
      role: 'VIEWER',
      tenantId: tenant.id,
    },
  })

  console.log('Created viewer user:', viewer.email)

  const apiKeyValue = 'demo-api-key-12345'
  const keyHash = createHash('sha256').update(apiKeyValue).digest('hex')
  
  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      keyHash,
    },
  })

  console.log('Created API key:', apiKeyValue)
  console.log('API key ID:', apiKey.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
