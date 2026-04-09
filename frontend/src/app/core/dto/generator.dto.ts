export interface GeneratorInfo {
    slug: string;
    name: string;
    description: string;
}

export interface GenerateRequest {
    includeHtml?: boolean;
}

export interface GenerateResponse {
    text: string;
    markdown: string;
    html?: string;
}
