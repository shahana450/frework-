import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AiService } from "./ai.service";
import { IsString, IsArray, IsOptional, IsNumber, IsObject } from "class-validator";

class GenerateResumeDto {
  @IsString() name: string;
  @IsString() title: string;
  @IsString() bio: string;
  @IsArray() skills: string[];
  @IsArray() experience: any[];
  @IsArray() education: any[];
}

class GenerateProposalDto {
  @IsString() freelancerName: string;
  @IsArray() freelancerSkills: string[];
  @IsString() jobTitle: string;
  @IsString() jobDescription: string;
  @IsOptional() @IsString() clientName?: string;
  @IsOptional() @IsNumber() budget?: number;
}

class ChatDto {
  @IsArray() messages: { role: "user" | "assistant"; content: string }[];
}

class TranslateDto {
  @IsString() text: string;
  @IsString() targetLanguage: string;
}

class MeetingSummaryDto {
  @IsString() transcript: string;
}

@ApiTags("AI")
@Controller({ path: "ai", version: "1" })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("resume")
  @ApiOperation({ summary: "Generate AI-powered resume" })
  async generateResume(@Body() dto: GenerateResumeDto) {
    return { content: await this.aiService.generateResume(dto) };
  }

  @Post("proposal")
  @ApiOperation({ summary: "Generate AI job proposal" })
  async generateProposal(@Body() dto: GenerateProposalDto) {
    return { content: await this.aiService.generateProposal(dto) };
  }

  @Post("chat")
  @ApiOperation({ summary: "Chat with WorkSphere AI assistant" })
  async chat(@Body() dto: ChatDto) {
    return { message: await this.aiService.chat(dto.messages) };
  }

  @Post("translate")
  @ApiOperation({ summary: "AI-powered translation" })
  async translate(@Body() dto: TranslateDto) {
    return { translation: await this.aiService.translateText(dto.text, dto.targetLanguage) };
  }

  @Post("meeting-summary")
  @ApiOperation({ summary: "Summarize meeting transcript" })
  async meetingSummary(@Body() dto: MeetingSummaryDto) {
    return this.aiService.summarizeMeeting(dto.transcript);
  }
}
