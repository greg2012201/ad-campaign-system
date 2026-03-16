import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CreateCampaignDto } from "./dtos/create-campaign.dto";
import { CampaignListQueryDto } from "./dtos/campaign-list-response.dto";

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Get()
  async findAll(@Query() query: CampaignListQueryDto) {
    return this.campaignsService.findAll(query);
  }

  @Get(":id")
  async findById(@Param("id") id: string) {
    return this.campaignsService.findById(id);
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string) {
    return this.campaignsService.cancel(id);
  }
}
