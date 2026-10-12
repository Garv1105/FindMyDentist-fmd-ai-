import { requireAuth } from "@/server/auth";
import { createPost, myPosts } from "@/server/content";
import { body, handler } from "@/server/http";

export const GET = handler(async (req) => Response.json({ items: myPosts(requireAuth(req)) }));
export const POST = handler(async (req) => Response.json(createPost(requireAuth(req), await body(req)), { status: 201 }));
