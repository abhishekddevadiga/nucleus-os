import { db } from "./db";

// Notification fan-out. In-app notifications are stored; email/WhatsApp are
// provider stubs — plug in your email/Slack provider here.
// Each external send is recorded as a Notification row with its channel so
// the wiring is observable before a provider is connected.

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  channels?: ("in_app" | "email" | "whatsapp")[];
}

export async function notify(input: NotifyInput) {
  const channels = input.channels ?? ["in_app"];
  await db.notification.createMany({
    data: channels.map((channel) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      channel,
    })),
  });
  // Provider stub: when WATI/Twilio/SMTP are configured, dispatch here.
  const external = channels.filter((c) => c !== "in_app");
  if (external.length && process.env.NODE_ENV === "development") {
    console.log(`[notify:${external.join(",")}] -> user ${input.userId}: ${input.title}`);
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  for (const userId of [...new Set(userIds)]) {
    await notify({ ...input, userId });
  }
}
