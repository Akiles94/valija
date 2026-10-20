/**
 * The normalized intermediate representation every parser produces: a provider's
 * export shape reduced to conversations of role-tagged messages. Nothing in this
 * module does I/O — it is the shared vocabulary the parsers, the chunk/render
 * service, and the selection service all speak.
 */
export type Role = "user" | "assistant" | "system";

/** One message of a conversation, tagged with who wrote it. */
export interface Message {
  readonly role: Role;
  readonly content: string;
  readonly createdAt?: Date;
}

/** A chat conversation normalised from any provider's export. */
export interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly createdAt: Date;
  readonly messages: readonly Message[];
}
