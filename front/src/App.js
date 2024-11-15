import React, { useState, useEffect } from 'react';
import './Chatbot.css';

const Chatbot = () => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversations, setConversations] = useState({});
    const [activeConversation, setActiveConversation] = useState(null);
    const [image, setImage] = useState(null); // État pour stocker l'image

    useEffect(() => {
        startNewConversation();
    }, []);

    // Fonction pour démarrer une nouvelle conversation
    const startNewConversation = async () => {
        try {
            const response = await fetch("http://127.0.0.1:5000/api/start_conversation", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await response.json();
            const newConversationId = data.conversation_id;

            setConversations(prev => ({
                ...prev,
                [newConversationId]: []
            }));
            setActiveConversation(newConversationId);
            setMessages([]);
        } catch (error) {
            console.error("Erreur lors de la création de la nouvelle conversation:", error);
        }
    };

    // Fonction pour réinitialiser une conversation
    const resetConversation = async () => {
        if (!activeConversation) return;

        try {
            await fetch("http://127.0.0.1:5000/api/reset_conversation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversation_id: activeConversation })
            });

            setConversations(prev => ({
                ...prev,
                [activeConversation]: []
            }));
            setMessages([]);
        } catch (error) {
            console.error("Erreur lors de la réinitialisation de la conversation:", error);
        }
    };

    // Fonction pour gérer la sélection d'image
    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    // Fonction pour gérer l'envoi de message (texte + image si présente)
    const handleSendMessage = async () => {
        if (!userInput.trim() && !image) return;

        const newMessages = [...messages, { sender: "user", content: userInput, image }];
        setMessages(newMessages);
        setUserInput("");
        setLoading(true);

        // Création d'un formulaire pour l'envoi de données texte et fichier image
        const formData = new FormData();
        formData.append("message", userInput);
        formData.append("conversation_id", activeConversation);
        if (image) {
            formData.append("image", image); // Ajoute l'image au formulaire si elle est présente
        }

        try {
            const response = await fetch("http://127.0.0.1:5000/api/message", {
                method: "POST",
                body: formData
            });
            const data = await response.json();

            if (response.ok) {
                const botMessage = { sender: "bot", content: data.response };
                setMessages([...newMessages, botMessage]);
                setConversations(prev => ({
                    ...prev,
                    [activeConversation]: [...newMessages, botMessage]
                }));
            } else {
                setMessages([...newMessages, { sender: "bot", content: "Désolé, je n'ai pas pu répondre." }]);
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi du message:", error);
            setMessages([...newMessages, { sender: "bot", content: "Erreur de connexion au serveur." }]);
        } finally {
            setLoading(false);
            setImage(null); // Réinitialise l'image après l'envoi
        }
    };

    // Gérer la sélection d'une conversation
    const handleSelectConversation = (conversationId) => {
        setActiveConversation(conversationId);
        setMessages(conversations[conversationId] || []);
    };

    // Fonction pour supprimer une conversation
    const deleteConversation = (conversationId) => {
        setConversations(prev => {
            const newConversations = { ...prev };
            delete newConversations[conversationId];
            return newConversations;
        });

        if (conversationId === activeConversation) {
            setActiveConversation(null);
            setMessages([]);
        }
    };

    // Gérer le changement d'input texte
    const handleInputChange = (e) => {
        setUserInput(e.target.value);
    };

    return (
        <div className="chatbot-container">
            <div className="chatbot-header">Chatbot</div>
            <button className="conversation-button" onClick={startNewConversation}>Nouvelle Conversation</button>
            <button className="conversation-button" onClick={resetConversation} disabled={!activeConversation}>Réinitialiser la Conversation</button>

            <div className="conversation-list">
                <h2>Conversations</h2>
                <ul>
                    {Object.keys(conversations).map((conversationId) => (
                        <li key={conversationId}>
                            <button 
                                className="conversation-button"
                                onClick={() => handleSelectConversation(conversationId)}
                                style={{ fontWeight: conversationId === activeConversation ? 'bold' : 'normal' }}
                            >
                                Conversation {conversationId === activeConversation ? '(Active)' : ''}
                            </button>
                            <button 
                                className="conversation-button"
                                onClick={() => deleteConversation(conversationId)}
                                style={{ backgroundColor: '#f44336', marginLeft: '10px' }}
                            >
                                Supprimer
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="message-box">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender === "user" ? "message-user" : "message-bot"}`}>
                        {msg.content && <p>{msg.content}</p>}
                        {msg.image && <img src={URL.createObjectURL(msg.image)} alt="Envoyé" className="message-image" />}
                    </div>
                ))}
            </div>

            <div className="input-container">
                <input className="input-field" type="text" value={userInput} onChange={handleInputChange} placeholder="Tapez votre message" />
                <input type="file" onChange={handleImageChange} /> {/* Champ pour le téléchargement d'image */}
                <button className="send-button" onClick={handleSendMessage} disabled={loading}>{loading ? "Envoi..." : "Envoyer"}</button>
            </div>
        </div>
    );
};

export default Chatbot;
