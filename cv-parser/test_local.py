import base64
import json
import requests

# ══════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════

CV_PATH = r"C:\Users\amaazi002\Downloads\cvtest.pdf"
API_URL = "http://localhost:5000"

# ══════════════════════════════════════
# TEST /health
# ══════════════════════════════════════

def test_health():
    print("=" * 50)
    print("TEST /health")
    print("=" * 50)
    response = requests.get(f"{API_URL}/health")
    print(f"Status : {response.status_code}")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    print()

# ══════════════════════════════════════
# TEST /parse-cv
# ══════════════════════════════════════

def test_parse_cv(cv_path):
    print("=" * 50)
    print("TEST /parse-cv")
    print("=" * 50)

    with open(cv_path, "rb") as f:
        file_bytes  = f.read()
        file_base64 = base64.b64encode(file_bytes).decode("utf-8")

    ext = cv_path.split(".")[-1].lower()
    content_types = {
        "pdf"  : "application/pdf",
        "docx" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc"  : "application/msword"
    }
    content_type = content_types.get(ext, "application/pdf")
    file_name    = cv_path.split("\\")[-1].split("/")[-1]

    print(f"Fichier    : {file_name}")
    print(f"Type       : {content_type}")
    print(f"Taille b64 : {len(file_base64)} caractères")

    response = requests.post(
        f"{API_URL}/parse-cv",
        json={
            "fileBase64"  : file_base64,
            "fileName"    : file_name,
            "contentType" : content_type
        }
    )

    print(f"\nStatus : {response.status_code}")
    result = response.json()
    print(f"\nRésultat :")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # ✅ Afficher un résumé clair
    print("\n" + "=" * 50)
    print("RÉSUMÉ PARSING")
    print("=" * 50)
    print(f"✅ Années exp      : {result.get('anneesExperience', 0)}")
    print(f"✅ Compétences tech: {result.get('competencesTech',  '')[:80]}...")
    print(f"✅ Expérience prof : {result.get('experienceProf',   '')[:80]}...")
    print(f"✅ Soft skills     : {result.get('competencesPerso', '')[:80]}...")
    print(f"✅ Diplôme         : {result.get('dernierDiplome',   '')}")
    print(f"✅ École           : {result.get('ecoleUniversite',  '')}")
    print(f"✅ Année obtention : {result.get('anneeObtention',   '')}")
    if result.get('warning'):
        print(f"⚠️  Warning        : {result.get('warning')}")

    return result

# ══════════════════════════════════════
# TEST /match-cv
# ══════════════════════════════════════

def test_match_cv(cv_data):
    print("\n" + "=" * 50)
    print("TEST /match-cv")
    print("=" * 50)

    # ✅ Saisir les vraies valeurs de l'offre
    print("\nEntrez les détails de l'offre :")
    print("-" * 40)
    competences_requises = input("Compétences requises : ")
    description_offre    = input("Description offre    : ")

    response = requests.post(
        f"{API_URL}/match-cv",
        json={
            "cvData"              : cv_data,
            "competencesRequises" : competences_requises,
            "descriptionOffre"    : description_offre
        }
    )

    print(f"\nStatus : {response.status_code}")
    result = response.json()
    print(f"\nRésultat :")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    # ✅ Afficher un résumé clair
    print("\n" + "=" * 50)
    print("RÉSUMÉ MATCHING")
    print("=" * 50)
    print(f"🎯 Score final     : {result.get('score', 0)}/100")
    print(f"📊 Niveau          : {result.get('niveau', '')}")
    details = result.get('details', {})
    print(f"   ├ Compétences   : {details.get('competences_techniques', 0)}/40")
    print(f"   ├ Expérience    : {details.get('experience', 0)}/25")
    print(f"   ├ Années exp    : {details.get('annees_experience', 0)}/15")
    print(f"   ├ Formation     : {details.get('formation', 0)}/10")
    print(f"   └ Soft skills   : {details.get('soft_skills', 0)}/10")

    return result

# ══════════════════════════════════════
# MAIN
# ══════════════════════════════════════

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        cv_path = sys.argv[1]
    else:
        cv_path = CV_PATH

    print(f"\n🚀 Test avec le fichier : {cv_path}\n")

    # ✅ Test 0 — Health check
    test_health()

    # ✅ Test 1 — Parsing
    cv_data = test_parse_cv(cv_path)

    # ✅ Test 2 — Matching
    if "error" not in cv_data:
        test_match_cv(cv_data)
    else:
        print(f"\n❌ Parsing échoué : {cv_data.get('error')}")