import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

@Controller("templates")
export class TemplateController {
  @Get(":campaignId/index.html")
  async serve(
    @Param("campaignId") campaignId: string,
    @Res() reply: FastifyReply,
  ) {
    const filePath = join(process.cwd(), "storage", campaignId, "index.html");

    try {
      const html = await readFile(filePath, "utf-8");
      return reply.type("text/html").send(html);
    } catch {
      throw new NotFoundException(
        `Template not found for campaign ${campaignId}`,
      );
    }
  }
}
