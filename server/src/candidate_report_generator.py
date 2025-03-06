import pandas as pd
import pdfminer.high_level  # For extracting text from PDFs. Consider using `pdfminer.six` as a more stable alternative if available
from io import StringIO
from collections import defaultdict
import sys
import os
import re
from google import genai
from google.genai import types

# Utility Functions
def read_pdf(file_path):
    """Extract text from a PDF file."""
    try:
        print(f"Reading PDF file: {file_path}")
        # Check if file exists and is readable
        if not os.path.exists(file_path):
            print(f"Error: PDF file does not exist at {file_path}")
            return ""
            
        if not os.access(file_path, os.R_OK):
            print(f"Error: PDF file is not readable at {file_path}")
            return ""
            
        # Get file size
        file_size = os.path.getsize(file_path)
        print(f"PDF file size: {file_size} bytes")
        
        if file_size == 0:
            print(f"Error: PDF file is empty at {file_path}")
            return ""
            
        with open(file_path, 'rb') as f:
            try:
                text = pdfminer.high_level.extract_text(f)
                print(f"Successfully read PDF: {file_path}, {len(text)} characters")
                return text
            except Exception as e:
                print(f"Error extracting text from PDF {file_path}: {e}")
                # Try a more basic approach as fallback
                try:
                    f.seek(0)
                    import PyPDF2
                    reader = PyPDF2.PdfReader(f)
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() + "\n"
                    print(f"Successfully read PDF with PyPDF2 fallback: {file_path}, {len(text)} characters")
                    return text
                except Exception as e2:
                    print(f"Error with PyPDF2 fallback for {file_path}: {e2}")
                    return f"[Error reading PDF: {str(e)}]"
    except FileNotFoundError:
        print(f"Error: PDF file not found at {file_path}")
        return ""
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return ""

# Extract candidate name from filename
def extract_candidate_name(filename):
    """Extract candidate name from the filename."""
    # Remove path and extension
    base_name = os.path.basename(filename)
    name_without_ext = os.path.splitext(base_name)[0]
    
    # Remove any timestamp or unique identifiers (like pdfFiles-1234567890-123456789)
    clean_name = re.sub(r'pdfFiles-\d+-\d+', '', name_without_ext)
    
    # Replace underscores with spaces
    clean_name = clean_name.replace('_', ' ').strip()
    
    return clean_name

def calculate_match_score(row):
    """Calculate the overall match score based on the given weights."""
    experience_weight = 0.30
    skills_weight = 0.25
    values_weight = 0.25
    language_weight = 0.20

    # Assuming a base of 10 for the preparedness and values alignment
    experience_score = row['relevant_experience_years']  # Treat years directly as a factor, to some degree.
    preparedness = row['preparedness_score'] / 10 if row['preparedness_score'] is not None else 0
    values_alignment = row['values_alignment_score'] / 10 if row['values_alignment_score'] is not None else 0
    language_proficiency = row['language_proficiency_score'] / 10 if row['language_proficiency_score'] is not None else 0

    # Simple skills score (adjust logic here if more complex skill analysis is needed)
    skills_matched = len(row['key_skills_mentioned']) if row['key_skills_mentioned'] is not None else 0
    skills_score = min(skills_matched / 5, 1) #cap skills weight

    # Calculated Weighted Sum
    match_score = (
        experience_weight * min(experience_score/10, 1) + #Cap Experience Weight
        skills_weight * skills_score +
        values_weight * values_alignment +
        language_weight * language_proficiency
    )

    return round(match_score * 100, 1)


def extract_pros_cons(row, resume_text = ""):
    """Extract pros and cons based on scores and resume content."""
    pros = []
    cons = []

    # Pros - From scores and keywords
    if row['preparedness_score'] >= 7:
        pros.append("Well-prepared for the interview.")
    if row['values_alignment_score'] >= 7:
        pros.append("Strong alignment with company values.")
    if row['language_proficiency_score'] >= 7:
        pros.append("Excellent communication skills.")
    if row['relevant_experience_years'] >= 5:
        pros.append("Demonstrates considerable experience in relevant roles.")

    # Additional skills gleaned from resume
    if resume_text:
        if "leadership" in resume_text.lower():
            pros.append("Demonstrated leadership experience.")
        if "project management" in resume_text.lower():
            pros.append("Experience with project management.")

    # Cons - From lower scores and gaps in skills
    if row['preparedness_score'] <= 5:
        cons.append("Needs further preparation on the role and company.")
    if row['values_alignment_score'] <= 5:
        cons.append("Values alignment could be stronger.")
    if row['language_proficiency_score'] <= 5:
        cons.append("Communication skills need improvement.")

    if row['relevant_experience_years'] < 3:
        cons.append("Relatively limited experience in relevant roles.")

    return pros, cons

# Main Report Generation Function
def generate_candidate_report(candidate_data):
    """Generate candidate analysis report using Gemini API.
    
    Args:
        candidate_data: String containing the candidate information, job description, and other relevant data
        
    Returns:
        The generated HTML report as text
    """
    # Initialize the Gemini client
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
        
    client = genai.Client(api_key=api_key)

    # Define the system prompt
    system_prompt = """<system_prompt>
# Candidate Analysis Report Generator

You are an expert system for analyzing technical candidate data and generating standardized reports. Your task is to process candidate information from CSV and PDF files and create a comprehensive HTML report with a dashboard overview and detailed candidate profiles.

## Input Format

You will receive two types of files:

1. CSV file containing candidate evaluation data with columns:
<csv_file>
	<data_schema>
{
  \"interview_id\": \"integer\"
  \"candidate_name\": \"string\",
  \"job_title_applied_for\": \"string\",
  \"key_skills_mentioned\": [\"string\"],
  \"relevant_experience_years\": \"integer\",
  \"additional_experience_shared\": \"string\",
  \"preparedness_score\": \"integer\",
  \"values_alignment_score\": \"integer\",
  \"language_proficiency_score\": \"integer\",
  \"final_recommendation\": \"boolean\"
}
	</data_schema>
	<structured_data_prompt>

\"Based on the interview, provide structured data in the following fields:
- Interview ID
- Candidate Name: Full name of the candidate.
- Job Title Applied For: Position the candidate applied for.
- Key Skills Mentioned: List of key skills highlighted during the interview.
- Relevant Experience (Years): Number of years of relevant experience shared by the candidate.
- Additional Experience Shared: Notable projects or experiences the candidate shared beyond their resume.
- Preparedness Score (1-10): Score based on how well the candidate knew the role and company.
- Values Alignment Score (1-10): Score based on the alignment with company values.
- Language Proficiency Score (1-10): Score based on clarity and communication.
- Final Recommendation: Recommendation on whether the candidate should proceed to the next step.\"
	</structured_data_prompt>
</csv_file>

2. PDF/text files containing candidate resumes

## Output Format

Generate an HTML report with two main sections:

1. Dashboard Overview
   - Candidate summary cards with:
     - Name and years of experience
     - English level
     - Overall match score
     - Preparedness score
     - Values alignment score
     - Visual score bars using tailwind classes

2. Detailed Profiles
   For each candidate:
   - Core Info section
     - Experience & Skills
     - Logistics (start date, location, availability)
   - Pros and Cons section
     - Extract key strengths as bullet points
     - List potential concerns or areas for improvement
   - Detailed Analysis
     - Technical Assessment
     - Cultural Fit
     - Growth Potential
     - Additional Notes

## Guidelines

1. Use consistent color coding per candidate:
   - First candidate: Blue theme (blue-800, blue-500, etc.)
   - Second candidate: Green theme
   - Third candidate: Purple theme

2. For Pros/Cons:
   - Extract pros from high scores and positive keywords in experience
   - Extract cons from lower scores and missing skills/experience
   - Keep points concise and scannable

3. Visual Elements:
   - Use progress bars for scores
   - Include appropriate icons for pros/cons
   - Maintain responsive layout using Tailwind CSS

4. Scoring:
   - Calculate overall match based on:
     - Experience weight: 30%
     - Skills match: 25%
     - Values alignment: 25%
     - Language proficiency: 20%

## Special Instructions

1. Always use Tailwind CSS for styling
2. Only use core utility classes (avoid arbitrary values)
3. Keep English levels as text (B1, B2, etc.) rather than scores
4. Focus on scannable, concise points in pros/cons
5. Use consistent score visualization styles
6. Include any relevant certifications or specialized training from resumes

Remember to analyze both the structured data from CSV and unstructured data from resumes to provide a complete picture of each candidate.
</system_prompt>"""

    # Combine system prompt with candidate data
    full_prompt = system_prompt + "\n\n" + candidate_data

    try:
        # Set up the model and configuration
        model = "gemini-2.0-flash-lite"
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=full_prompt)],
            ),
        ]
        generate_content_config = types.GenerateContentConfig(
            temperature=1,
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
            response_mime_type="text/plain",
        )

        # Generate the content
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        
        return response.text
    
    except Exception as e:
        print(f"Error generating candidate report: {str(e)}")
        raise

# When script is run directly, use command line arguments
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python candidate_report_generator.py <csv_file> <pdf_file1> [<pdf_file2> ...]")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    resume_files = sys.argv[2:]
    
    # If you need to use the API key in the Python script:
    # api_key = os.environ.get('GOOGLE_API_KEY')
    # if not api_key:
    #     print("Error: GOOGLE_API_KEY environment variable is not set")
    #     sys.exit(1)
    
    report_html = generate_candidate_report(csv_file, resume_files)
    
    # Print to stdout so Express can capture it
    print(report_html) 