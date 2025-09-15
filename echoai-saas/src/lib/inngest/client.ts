import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "echoai-saas",
  name: "EchoAI SaaS",
  eventKey: process.env.INNGEST_EVENT_KEY,
});