import { Hono } from "hono";
import { PrismaClient } from '@prisma/client'

const router = new Hono()
const prisma = new PrismaClient()

router.post('/topics', async (c) => {
  try {
    const { name, description } = await c.req.json();
    const newTopic = await prisma.topic.create({
      data: {  name, description },
    });
    return c.json({
      message: 'Topic created successfully',
      topic: newTopic
    }, 201)  // Changed from 200 to 201 for resource creation
  } catch (error) {
    console.error('Error in creating the topic:', error)
    return c.json({ error: 'An error occurred while creating the topic' }, 500)
  }
})

router.get('/topics', async (c) => {
  try {
    const topics = await prisma.topic.findMany();
    return c.json(topics)
  } catch (error) {
    console.error('Error fetching topics:', error)
    return c.json({ error: 'An error occurred while fetching topics' }, 500)
  }
})

router.get('/topics/:topicId', async(c)=>
{
    const topic = await prisma.topic.findUnique({
        where: { id: parseInt(c.req.param('topicId')) },
        include: { questions: true },
      });
      if (!topic) {
         return c.json({error: 'an error occured while fetching questions'})
      }
      return c.json(topic)
})

router.post('/topics/:topicId/questions', async(c)=>{
    try {
    const { title, isSolved, link, youtube } =  await c.req.json()
    const topicId = parseInt(c.req.param('topicId'));
    const newQuestions = await prisma.question.create({
        data: {title, isSolved, link, youtube, topicId}
    })

    return c.json({
        message: 'Topic created successfully',
        topic: newQuestions
      }, 201)

    } catch(error){
        console.error('Error in creating the topic:', error)
    return c.json({ error: 'An error occurred while creating the topic' }, 500)

    }
})












export default router  // Changed from 'server' to 'app'