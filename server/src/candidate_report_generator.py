import pandas as pd
import pdfminer.high_level  # For extracting text from PDFs. Consider using `pdfminer.six` as a more stable alternative if available
from io import StringIO
from collections import defaultdict
import sys
import os
import re

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
def generate_candidate_report(csv_file, resume_files):
    """Generates the full HTML report."""
    try:
        print(f"Reading CSV file: {csv_file}")
        df = pd.read_csv(csv_file)

        # Properly handle list representation for 'key_skills_mentioned'
        df['key_skills_mentioned'] = df['key_skills_mentioned'].apply(eval)  #WARNING: eval is dangerous

        candidate_data = df.to_dict('records')
        print(f"Found {len(candidate_data)} candidates in CSV")

    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file}")
        return "<p>Error: CSV file not found.</p>"
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return f"<p>Error reading CSV: {e}</p>"

    candidate_profiles = defaultdict(dict)
    for candidate in candidate_data:
        candidate_profiles[candidate['candidate_name']] = candidate

    # Load and store resume data
    resume_texts = {}
    print(f"Processing {len(resume_files)} resume files")
    for filename in resume_files:
        resume_text = read_pdf(filename)
        
        # Try to match the resume to a candidate
        # First, try to extract the candidate name from the filename
        candidate_name = extract_candidate_name(filename)
        print(f"Extracted candidate name from filename: '{candidate_name}'")
        
        # Store the resume text under multiple possible keys to increase matching chances
        resume_texts[candidate_name] = resume_text
        resume_texts[candidate_name.lower()] = resume_text
        resume_texts[candidate_name.replace(" ", "_")] = resume_text
        resume_texts[candidate_name.replace(" ", "")] = resume_text
        
        # Also store with the original filename as a fallback
        base_name = os.path.basename(filename)
        resume_texts[base_name] = resume_text

    # Generate dashboard
    dashboard_html = generate_dashboard(candidate_data)

    # Generate profiles
    profiles_html = ""
    for candidate in candidate_data:
        candidate_name = candidate['candidate_name']
        print(f"Generating profile for: {candidate_name}")
        
        # Try different variations of the candidate name to match resume files
        resume_text = ""
        name_variations = [
            candidate_name,
            candidate_name.lower(),
            candidate_name.replace(" ", "_"),
            candidate_name.replace(" ", "")
        ]
        
        for name_var in name_variations:
            if name_var in resume_texts:
                resume_text = resume_texts[name_var]
                print(f"Found resume for {candidate_name} using variation: {name_var}")
                break
        
        if not resume_text:
            print(f"Warning: No resume found for {candidate_name}. Available resume keys: {list(resume_texts.keys())}")
        
        profile_html = generate_candidate_profile(candidate_profiles[candidate_name], resume_text)
        profiles_html += profile_html

    full_html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Candidate Analysis Report</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="container mx-auto p-8">
            <h1 class="text-3xl font-bold mb-4">Candidate Analysis Report</h1>
            {dashboard_html}
            <h2 class="text-2xl font-bold mt-8 mb-4">Detailed Profiles</h2>
            {profiles_html}
        </div>
    </body>
    </html>
    """
    return full_html


def generate_dashboard(candidate_data):
    """Generates the dashboard overview section of the report."""
    dashboard_cards = []
    candidate_colors = ["blue", "green", "purple"]  # Added more colors

    for i, candidate in enumerate(candidate_data):
        color = candidate_colors[i % len(candidate_colors)] # Use modulo for cycling through the colors
        match_score = calculate_match_score(candidate)
        card_html = f"""
            <div class="w-full md:w-1/3 p-4">
                <div class="bg-white rounded-lg shadow-md p-6 border border-{color}-200">
                    <h3 class="text-xl font-semibold text-{color}-800 mb-2">{candidate['candidate_name']}</h3>
                    <p class="text-gray-600">Experience: {candidate['relevant_experience_years']} years</p>
                    <p class="text-gray-600">English Level: {candidate['language_proficiency_score']}</p>
                    <p class="text-gray-600">Overall Match: {match_score}%</p>

                    <div class="mb-2">
                        <div class="text-sm font-bold text-{color}-700 mb-1">Preparedness: {candidate['preparedness_score']}</div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div class="bg-{color}-500 h-2.5 rounded-full" style="width: {candidate['preparedness_score']*10}%"></div>
                        </div>
                    </div>

                    <div class="mb-2">
                        <div class="text-sm font-bold text-{color}-700 mb-1">Values Alignment: {candidate['values_alignment_score']}</div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div class="bg-{color}-500 h-2.5 rounded-full" style="width: {candidate['values_alignment_score']*10}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        """
        dashboard_cards.append(card_html)

    dashboard_html = f"""
        <div class="flex flex-wrap -mx-4">
            {''.join(dashboard_cards)}
        </div>
    """
    return dashboard_html


def generate_candidate_profile(candidate, resume_text):
  """Generates the detailed profile for a single candidate."""
  color = "blue" #TODO: FIX THE COLOR cycling correctly for the dashboard + candidate profile pairing (requires higher order knowledge)
  match_score = calculate_match_score(candidate)
  pros, cons = extract_pros_cons(candidate, resume_text)

  # Create a resume excerpt that's not truncated
  resume_excerpt = resume_text[:500] + "..." if len(resume_text) > 500 else resume_text
  
  profile_html = f"""
  <div class="mb-8 p-6 bg-white rounded-lg shadow-md border border-{color}-200">
      <h3 class="text-xl font-semibold text-{color}-800 mb-4">{candidate['candidate_name']} - {candidate['job_title_applied_for']}</h3>

      <div class="mb-4">
          <h4 class="text-lg font-semibold text-{color}-700 mb-2">Core Info</h4>
          <p class="text-gray-600">Experience: {candidate['relevant_experience_years']} years</p>
          <p class="text-gray-600">Skills: {', '.join(candidate['key_skills_mentioned'])}</p>
          <p class="text-gray-600">Additional Experience: {candidate['additional_experience_shared']}</p>

          <div class="mt-2">
              <h5 class="text-md font-semibold text-{color}-600 mb-1">Resume Excerpt:</h5>
              <div class="text-gray-600 bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                  {resume_excerpt}
              </div>
          </div>
      </div>

      <div class="mb-4">
          <h4 class="text-lg font-semibold text-{color}-700 mb-2">Pros & Cons</h4>
          <div class="flex">
              <div class="w-1/2 pr-2">
                  <h5 class="text-md font-semibold text-{color}-600 mb-1">Pros</h5>
                  <ul class="list-disc list-inside text-gray-600">
                      {''.join([f'<li>{pro}</li>' for pro in pros])}
                  </ul>
              </div>
              <div class="w-1/2 pl-2">
                  <h5 class="text-md font-semibold text-{color}-600 mb-1">Cons</h5>
                  <ul class="list-disc list-inside text-gray-600">
                      {''.join([f'<li>{con}</li>' for con in cons])}
                  </ul>
              </div>
          </div>
      </div>

      <div class="mb-4">
          <h4 class="text-lg font-semibold text-{color}-700 mb-2">Detailed Analysis</h4>
          <p class="text-gray-600">Technical Assessment: {candidate['preparedness_score']}/10</p>
          <p class="text-gray-600">Cultural Fit: {candidate['values_alignment_score']}/10</p>
          <p class="text-gray-600">Language proficiency: {candidate['language_proficiency_score']}/10</p>
      </div>
  </div>
  """

  return profile_html


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