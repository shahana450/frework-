import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({ apiKey: configService.get("OPENAI_API_KEY") });
    this.model = configService.get("OPENAI_MODEL", "gpt-4o");
  }

  async generateResume(data: {
    name: string;
    title: string;
    bio: string;
    skills: string[];
    experience: any[];
    education: any[];
  }): Promise<string> {
    const prompt = `Generate a professional resume in Markdown format for:
Name: ${data.name}
Title: ${data.title}
Bio: ${data.bio}
Skills: ${data.skills.join(", ")}
Experience: ${JSON.stringify(data.experience)}
Education: ${JSON.stringify(data.education)}

Create a compelling, ATS-optimized resume with a professional summary, skills section, work experience with quantified achievements, and education. Return only the Markdown content.`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  async generateProposal(data: {
    freelancerName: string;
    freelancerSkills: string[];
    jobTitle: string;
    jobDescription: string;
    clientName?: string;
    budget?: number;
  }): Promise<string> {
    const prompt = `Write a compelling job proposal for a freelancer applying to a project:

Freelancer: ${data.freelancerName}
Skills: ${data.freelancerSkills.join(", ")}
Job Title: ${data.jobTitle}
Job Description: ${data.jobDescription}
${data.clientName ? `Client: ${data.clientName}` : ""}
${data.budget ? `Budget: $${data.budget}` : ""}

Write a personalized, professional proposal (250-400 words) that:
1. Addresses the client's specific needs
2. Highlights relevant experience and skills
3. Proposes a clear approach
4. Includes a compelling call to action
Return only the proposal text.`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 700,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  async matchFreelancersToJob(
    jobId: string,
    limit: number = 10
  ): Promise<{ freelancerId: string; score: number; reason: string }[]> {
    const job = await this.prisma.project.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    });

    if (!job) return [];

    const freelancers = await this.prisma.freelancerProfile.findMany({
      where: { availability: "AVAILABLE" },
      include: {
        user: { select: { id: true, name: true } },
        skills: { include: { skill: true } },
      },
      take: 50,
    });

    const jobSkills = job.skills.map((s) => s.skill.name);

    const scored = freelancers.map((f) => {
      const freelancerSkills = f.skills.map((s) => s.skill.name);
      const matchCount = jobSkills.filter((s) => freelancerSkills.includes(s)).length;
      const score = jobSkills.length > 0 ? (matchCount / jobSkills.length) * 100 : 0;

      return {
        freelancerId: f.userId,
        score: Math.round(score),
        reason: `Matches ${matchCount}/${jobSkills.length} required skills`,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async recommendWorkspaces(data: {
    city: string;
    budget: number;
    seats: number;
    amenities?: string[];
  }): Promise<any[]> {
    const spaces = await this.prisma.coworkingSpace.findMany({
      where: {
        city: { contains: data.city, mode: "insensitive" },
        isActive: true,
        availableSeats: { gte: data.seats },
      },
      include: { workspaces: { where: { isAvailable: true } } },
      take: 20,
    });

    // Simple scoring — in production use embeddings
    return spaces
      .map((space) => {
        const amenityMatch = data.amenities?.filter((a) =>
          space.amenities.includes(a)
        ).length ?? 0;
        return { ...space, aiScore: amenityMatch };
      })
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 5);
  }

  async summarizeMeeting(transcript: string): Promise<{
    summary: string;
    actionItems: string[];
    keyDecisions: string[];
  }> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: `Analyze this meeting transcript and return a JSON object with:
- summary (2-3 sentences)
- actionItems (array of action items)
- keyDecisions (array of decisions made)

Transcript: ${transcript}

Return only valid JSON.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: `Translate the following text to ${targetLanguage}. Return only the translated text:\n\n${text}`,
        },
      ],
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content ?? "";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0]?.embedding ?? [];
  }

  async chat(messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: "You are WorkSphere's AI assistant. Help users find talent, book workspaces, write proposals, and navigate the platform. Be concise and professional.",
        },
        ...messages,
      ],
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content ?? "";
  }
}
