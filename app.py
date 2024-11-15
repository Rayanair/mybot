import re
import base64
from flask import Flask, request, jsonify
import requests
from flask_cors import CORS
from uuid import uuid4
import os

app = Flask(__name__)
CORS(app)

# Configuration des dossiers pour stocker temporairement les images
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# URL de l'API du chatbot LLaVA
url = "http://localhost:1234/v1/chat/completions"

# Stockage des historiques de conversation par ID de session
conversations = {}

# Pré-information à envoyer au chatbot
intro_message = "Tu es un expert en conseils animaliers. Tu peux répondre seulement à toutes les questions liées aux animaux de compagnie, comme les soins, l'alimentation, les comportements, etc."

# Liste de mots-clés pour détecter des questions hors-sujet
off_topic_keywords = [
    "politique", "économie", "film", "musique", "sport", "argent", "finance",
    "voyage", "gouvernement", "santé humaine", "histoire", "actualité"
]

def is_off_topic(message):
    """
    Vérifie si le message de l'utilisateur est hors du sujet des conseils animaliers
    en recherchant des mots-clés.
    """
    message_lower = message.lower()
    for keyword in off_topic_keywords:
        if re.search(r'\b' + re.escape(keyword) + r'\b', message_lower):
            return True
    return False

@app.route('/api/start_conversation', methods=['POST'])
def start_conversation():
    """
    Crée une nouvelle conversation avec un ID unique.
    """
    conversation_id = str(uuid4())
    conversations[conversation_id] = [{"role": "system", "content": intro_message}]
    return jsonify({"conversation_id": conversation_id}), 200

@app.route('/api/reset_conversation', methods=['POST'])
def reset_conversation():
    """
    Réinitialise l'historique de la conversation pour un ID donné.
    """
    data = request.get_json()
    conversation_id = data.get("conversation_id", "")
    if conversation_id in conversations:
        conversations[conversation_id] = [{"role": "system", "content": intro_message}]
        return jsonify({"message": "Conversation réinitialisée"}), 200
    return jsonify({"error": "Conversation non trouvée"}), 404

@app.route('/api/message', methods=['POST'])
def message():
    """
    Gère les messages de l'utilisateur et envoie une requête à l'API du modèle avec l'image si présente.
    """
    conversation_id = request.form.get("conversation_id", "")
    user_message = request.form.get("message", "")
    image_file = request.files.get("image")  # Récupération de l'image si présente

    if conversation_id not in conversations:
        return jsonify({"error": "Conversation non trouvée"}), 404

    # Si le message est hors sujet, renvoyer une réponse appropriée
    if is_off_topic(user_message):
        return jsonify({
            "response": "Désolé, je suis un conseiller animalier. Je ne peux répondre qu'aux questions concernant les animaux de compagnie."
        }), 200

    # Traitement de l'image en base64 si présente
    image_base64 = None
    if image_file:
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_file.filename)
        image_file.save(image_path)
        
        # Convertir l'image en base64
        with open(image_path, "rb") as img_file:
            image_base64 = base64.b64encode(img_file.read()).decode('utf-8')

    # Construire le contenu utilisateur selon la structure demandée
    user_content = [{"type": "text", "text": user_message}]
    if image_base64:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{image_base64}"}
        })
    
    # Ajouter le message structuré de l'utilisateur à l'historique de conversation
    conversation_history = conversations[conversation_id]
    user_entry = {"role": "user", "content": user_content}
    conversation_history.append(user_entry)

    # Crée le payload pour la requête
    payload = {
        "messages": conversation_history,
        "max_tokens": 150,
        "temperature": 0.7
    }

    try:
        # Envoie la requête au serveur du modèle
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            response_data = response.json()
            bot_response = response_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            conversation_history.append({"role": "assistant", "content": bot_response})
            return jsonify({"response": bot_response}), 200
        else:
            return jsonify({"error": "Erreur du serveur interne"}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Erreur de connexion avec le chatbot : {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
