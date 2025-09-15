import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  
  // Example: Create a test user
  // const testUser = await prisma.user.create({
  //   data: {
  //     email: 'test@example.com',
  //     settings: {
  //       create: {
  //         chatbotName: 'Test Bot',
  //         welcomeMessage: 'Hello! This is a test chatbot.',
  //         primaryColor: '#3B82F6'
  //       }
  //     }
  //   }
  // })
  
  // console.log('Created test user:', testUser)
  
  console.log('✅ Seeding completed')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })