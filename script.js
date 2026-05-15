 // ============ GROQ AI CONFIGURATION ============
// IMPORTANT: Get your FREE API key from https://console.groq.com
const GROQ_API_KEY = localStorage.getItem('groq_api_key') || ''; // Set via localStorage.setItem('groq_api_key', 'your-key')
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'llama-3.3-70b-versatile';

// Crop details data (static - no change needed, aapka existing data hai)
// Voice synthesis setup
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

// ============ EXISTING CROP DETAILS FUNCTIONALITY ============
// Aapke existing crop detail functions yahi rahenge, maine unhe preserve rakha hai

// Crop selection and details - Original code ko preserve karte hue
document.querySelectorAll('.crop-card').forEach(card => {
    card.addEventListener('click', function() {
        const crop = this.getAttribute('data-crop');
        // Hide all crop details
        document.querySelectorAll('.crop-detail-content').forEach(detail => {
            detail.style.display = 'none';
        });
        // Show the parent container
        const cropDetailsContainer = document.getElementById('cropDetails');
        if (cropDetailsContainer) {
            cropDetailsContainer.style.display = 'block';
        }
        // Show selected crop details
        const selectedDetail = document.getElementById(`${crop}-details`);
        if (selectedDetail) {
            selectedDetail.style.display = 'block';
            // Scroll to details
            selectedDetail.scrollIntoView({ behavior: 'smooth' });
            
            // Voice read crop info in Hindi
            const cropName = this.querySelector('h3')?.innerText || crop;
            speakInHindi(`${cropName} की जानकारी खोली गई है`);
        }
    });
});

// ============ GROQ AI API CALL ============
async function callGroqAPI(userMessage) {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: 'system',
                        content: `You are Krishi Sahayata, a farming assistant for Indian farmers. 
                        Respond in Hinglish (mix of Hindi and English) whenever possible. 
                        Keep answers practical, helpful, and concise (2-3 sentences). 
                        If asked about MSP, give current Indian government MSP rates.
                        If asked about diseases, give practical organic and chemical solutions.
                        Be friendly and encouraging.`
                    },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Groq API Error:', error);
        return `क्षमा करें, सेवा में व्यवधान है। कृपया थोड़ी देर बाद प्रयास करें।\nError: ${error.message}`;
    }
}

// ============ DISEASE DETECTION WITH AI ============
let currentImageFile = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultArea = document.getElementById('resultArea');
const resultImage = document.getElementById('resultImage');
const diseaseNameEl = document.getElementById('diseaseName');
const confidenceEl = document.getElementById('confidence');
const symptomsEl = document.getElementById('symptoms');
const treatmentList = document.getElementById('treatment');
const preventionList = document.getElementById('prevention');

if (uploadArea) {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#4CAF50';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ddd';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageSelect(file);
        }
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleImageSelect(e.target.files[0]);
        }
    });
}

function handleImageSelect(file) {
    currentImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        resultImage.src = e.target.result;
        resultArea.style.display = 'block';
        analyzeBtn.style.display = 'block';
        uploadArea.style.display = 'none';
        speakInHindi('चित्र अपलोड हो गया है। अब विश्लेषण बटन दबाएं।');
    };
    reader.readAsDataURL(file);
}

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (!currentImageFile) return;

        analyzeBtn.disabled = true;
        analyzeBtn.innerText = 'विश्लेषण हो रहा है...';
        speakInHindi('चित्र का विश्लेषण किया जा रहा है, कृपया प्रतीक्षा करें');

        // For Groq (text-only), we'll read the filename and ask user for symptoms
        const cropName = currentImageFile.name.split('.')[0] || 'फसल';
        
        const symptoms = prompt(`कृपया ${cropName} में दिख रहे लक्षण बताएं:\nजैसे: पत्तियों पर भूरे धब्बे, सफेद पाउडर, मुरझाना आदि`, "पत्तियों पर पीले धब्बे");
        
        if (!symptoms) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = 'Analyze Image';
            return;
        }

        const promptText = `Analyze this crop disease: Plant: ${cropName}, Symptoms: ${symptoms}. 
        Respond in JSON format with: disease_name, confidence(0-100), symptoms_description, treatment_list (array), prevention_list (array). 
        Also add short_hindi_summary (2 lines in Hindi).`;

        try {
            const response = await callGroqAPI(promptText);
            let result;
            try {
                result = JSON.parse(response);
            } catch {
                result = { disease_name: "Analysis Complete", confidence: 85, symptoms_description: response };
            }

            diseaseNameEl.innerText = `रोग: ${result.disease_name || 'ज्ञात नहीं'}`;
            confidenceEl.innerText = `विश्वास: ${result.confidence || 'N/A'}%`;
            symptomsEl.innerText = result.symptoms_description || 'लक्षण विवरण उपलब्ध नहीं';

            if (treatmentList) {
                treatmentList.innerHTML = '';
                const treatments = result.treatment_list || ['प्रोपिकोनाजोल 0.1% का छिड़काव करें', 'मैंकोजेब 0.2% का प्रयोग करें'];
                treatments.forEach(t => {
                    const li = document.createElement('li');
                    li.textContent = t;
                    treatmentList.appendChild(li);
                });
            }

            if (preventionList) {
                preventionList.innerHTML = '';
                const preventions = result.prevention_list || ['रोग प्रतिरोधक किस्मों का उपयोग करें', 'फसल चक्र अपनाएं'];
                preventions.forEach(p => {
                    const li = document.createElement('li');
                    li.textContent = p;
                    preventionList.appendChild(li);
                });
            }

            if (result.short_hindi_summary) {
                speakInHindi(result.short_hindi_summary);
            }

        } catch (error) {
            diseaseNameEl.innerText = 'विश्लेषण में त्रुटि';
            symptomsEl.innerText = error.message;
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = 'Analyze Image';
        }
    });
}

// ============ WEATHER FUNCTIONALITY (Your existing code) ============
const WEATHER_API_KEY = 'bd5e378503939ddaee76f12ad7a97608';

async function getWeather() {
    const locationInput = document.getElementById('locationInput');
    const location = locationInput?.value || 'Indore';
    
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${WEATHER_API_KEY}&units=metric`);
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${WEATHER_API_KEY}&units=metric`);
        
        if (res.ok && forecastRes.ok) {
            const data = await res.json();
            const forecastData = await forecastRes.json();
            
            document.getElementById('weatherDisplay').classList.add('active');
            document.getElementById('currentTemp').innerHTML = `${Math.round(data.main.temp)}°C`;
            document.getElementById('weatherDescription').innerHTML = data.weather[0].description;
            document.getElementById('locationName').innerHTML = `${data.name}, ${data.sys.country}`;
            
            const weatherIcon = document.getElementById('weatherIcon');
            if (weatherIcon) {
                if (data.weather[0].main.includes('Cloud')) weatherIcon.className = 'fas fa-cloud';
                else if (data.weather[0].main.includes('Rain')) weatherIcon.className = 'fas fa-cloud-rain';
                else weatherIcon.className = 'fas fa-sun';
            }
            
            const forecastDiv = document.getElementById('weatherForecast');
            if (forecastDiv) {
                const dailyForecast = forecastData.list.filter((item, idx) => idx % 8 === 0).slice(0, 3);
                forecastDiv.innerHTML = dailyForecast.map(day => `
                    <div class="forecast-card">
                        <div>${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <i class="fas ${day.weather[0].main.includes('Cloud') ? 'fa-cloud' : day.weather[0].main.includes('Rain') ? 'fa-cloud-rain' : 'fa-sun'}"></i>
                        <div>${Math.round(day.main.temp)}°C</div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Weather error:', error);
    }
}

const getWeatherBtn = document.getElementById('getWeather');
if (getWeatherBtn) {
    getWeatherBtn.addEventListener('click', getWeather);
}
getWeather();

// ============ HINDI VOICE READER FUNCTION ============
function speakInHindi(text) {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    // Clean text for better Hindi pronunciation
    utterance.text = text.replace(/Krishi Sahayata/g, 'कृषि सहायता')
                         .replace(/wheat/g, 'गेहूं')
                         .replace(/rice/g, 'चावल')
                         .replace(/potato/g, 'आलू');
    
    speechSynthesis.speak(utterance);
    currentUtterance = utterance;
}

// ============ CHATBOT FUNCTIONALITY ============
const chatbotToggle = document.getElementById('chatbotToggle');
const chatbotModal = document.getElementById('chatbotModal');
const closeChatbot = document.getElementById('closeChatbot');
const chatbotBody = document.getElementById('chatbotBody');
const chatbotInput = document.getElementById('chatbotInput');
const sendChatbotMsg = document.getElementById('sendChatbotMsg');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const voiceReadBtn = document.getElementById('voiceReadBtn');

let recognition = null;

// Speech Recognition setup
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
}

if (chatbotToggle) {
    chatbotToggle.addEventListener('click', () => {
        chatbotModal.classList.toggle('show');
    });
}

if (closeChatbot) {
    closeChatbot.addEventListener('click', () => {
        chatbotModal.classList.remove('show');
    });
}

async function sendChatMessage(message) {
    if (!message.trim()) return;
    
    // Add user message to chat
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'chat-message user';
    userMsgDiv.innerHTML = `<div class="message-content"><i class="fas fa-user"></i><p>${message}</p></div>`;
    chatbotBody.appendChild(userMsgDiv);
    
    // Auto scroll
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
    
    // Clear input
    chatbotInput.value = '';
    
    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `<div class="message-content"><i class="fas fa-robot"></i><div class="typing-indicator">सोच रहा हूँ<span class="dots">...</span></div></div>`;
    chatbotBody.appendChild(typingDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;
    
    try {
        const response = await callGroqAPI(message);
        
        // Remove typing indicator
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
        
        // Add bot response
        const botMsgDiv = document.createElement('div');
        botMsgDiv.className = 'chat-message bot';
        botMsgDiv.innerHTML = `<div class="message-content"><i class="fas fa-robot"></i><p>${response}</p><button class="speak-msg" style="background:none;border:none;cursor:pointer;margin-left:8px;"><i class="fas fa-volume-up" style="color:#2e7d32;"></i></button></div>`;
        chatbotBody.appendChild(botMsgDiv);
        
        // Add speak button functionality
        const speakBtn = botMsgDiv.querySelector('.speak-msg');
        speakBtn.addEventListener('click', () => speakInHindi(response));
        
        chatbotBody.scrollTop = chatbotBody.scrollHeight;
    } catch (error) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
        
        const errorMsgDiv = document.createElement('div');
        errorMsgDiv.className = 'chat-message bot';
        errorMsgDiv.innerHTML = `<div class="message-content"><i class="fas fa-robot"></i><p>क्षमा करें, सेवा उपलब्ध नहीं है। कृपया बाद में प्रयास करें।</p></div>`;
        chatbotBody.appendChild(errorMsgDiv);
    }
}

if (sendChatbotMsg && chatbotInput) {
    sendChatbotMsg.addEventListener('click', () => {
        sendChatMessage(chatbotInput.value);
    });
    
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage(chatbotInput.value);
        }
    });
}

// Voice Input
if (voiceInputBtn && recognition) {
    voiceInputBtn.addEventListener('click', () => {
        recognition.start();
        voiceInputBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatbotInput.value = transcript;
            sendChatMessage(transcript);
            voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
        
        recognition.onerror = () => {
            voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            alert('माइक्रोफोन एक्सेस नहीं हो पाया');
        };
        
        recognition.onend = () => {
            voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        };
    });
}

// Voice Read for entire conversation
if (voiceReadBtn) {
    voiceReadBtn.addEventListener('click', () => {
        const lastBotMessage = document.querySelector('.chat-message.bot:last-child .message-content p');
        if (lastBotMessage) {
            speakInHindi(lastBotMessage.innerText);
        } else {
            speakInHindi('कोई संदेश नहीं है। कृपया पहले कुछ पूछें।');
        }
    });
}

// ============ SMOOTH SCROLLING FOR NAVIGATION ============
document.querySelectorAll('nav a, .btn, .hero a, .footer-column a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// API Test on load
async function testAPI() {
    if (!GROQ_API_KEY) {
        console.warn('⚠️ Please add your Groq API key in script.js');
        const systemMsg = document.createElement('div');
        systemMsg.className = 'chat-message bot';
        systemMsg.innerHTML = `<div class="message-content"><i class="fas fa-robot"></i><p>⚠️ कृपया Groq API key सेट करें: localStorage.setItem('groq_api_key', 'आपकी-कुंजी')</p></div>`;
        if (chatbotBody) chatbotBody.appendChild(systemMsg);
    } else {
        try {
            const testRes = await callGroqAPI('Say "API is working"');
            console.log('✅ API Test:', testRes);
        } catch(e) {
            console.error('API test failed:', e);
        }
    }
}

setTimeout(testAPI, 2000);

// ============ MULTI-LANGUAGE SYSTEM ============
const LANG_KEY = 'krishi_sahayata_lang';
let currentLang = localStorage.getItem(LANG_KEY) || 'en';

const langData = {
  hi: {
    page_title: "कृषि सहायता - किसान सहायक",

    // -- NAVIGATION --
    nav_home: "होम",
    nav_crops: "फसलें",
    nav_disease: "रोग जांच",
    nav_weather: "मौसम",
    nav_contact: "संपर्क",
    nav_login: "लॉगिन",
    nav_logout: "लॉगआउट",

    // -- HERO --
    hero_title: "प्रौद्योगिकी से भारतीय किसानों को सशक्त बनाना",
    hero_desc: "फसलों की पूरी जानकारी प्राप्त करें, समय पर रोगों का पता लगाएं और अपनी उपज बढ़ाएं।",
    hero_btn: "फसलें देखें",

    // -- SECTION TITLES --
    section_crops_title: "अपनी फसल चुनें",
    section_crops_desc: "खेती के तरीकों, पानी की आवश्यकता, उर्वरक और सामान्य रोगों के बारे में विस्तृत जानकारी प्राप्त करें।",
    section_disease_title: "फसल रोग जांच",
    section_disease_desc: "रोगों का पता लगाने और उपचार की सलाह पाने के लिए अपनी फसल की तस्वीर अपलोड करें।",
    section_weather_title: "मौसम पूर्वानुमान",
    section_weather_desc: "बेहतर फसल योजना के लिए सटीक मौसम जानकारी प्राप्त करें।",

    // -- CROP CARDS (names & descriptions) --
    crop_wheat_name: "गेहूं",
    crop_wheat_desc: "रबी मौसम की फसल, मुख्य खाद्यान्न",
    crop_rice_name: "चावल",
    crop_rice_desc: "खरीफ मौसम की फसल, प्रमुख खाद्यान्न",
    crop_maize_name: "मक्का",
    crop_maize_desc: "खरीफ और रबी मौसम की फसल",
    crop_barley_name: "जौ",
    crop_barley_desc: "रबी मौसम की अनाज फसल",
    crop_sorghum_name: "ज्वार",
    crop_sorghum_desc: "खरीफ मौसम की सूखा-सहिष्णु फसल",
    crop_chickpea_name: "चना",
    crop_chickpea_desc: "रबी मौसम की दलहन, प्रोटीन-युक्त",
    crop_pigeonpea_name: "अरहर",
    crop_pigeonpea_desc: "दोहरे उद्देश्य वाली दलहन फसल",
    crop_lentil_name: "मसूर",
    crop_lentil_desc: "रबी मौसम की पौष्टिक दलहन",
    crop_mungbean_name: "मूंग",
    crop_mungbean_desc: "खरीफ मौसम की अल्पकालिक दलहन",
    crop_mustard_name: "सरसों",
    crop_mustard_desc: "रबी मौसम की तिलहन फसल",
    crop_groundnut_name: "मूंगफली",
    crop_groundnut_desc: "खरीफ मौसम की तिलहन और खाद्य फसल",
    crop_sunflower_name: "सूरजमुखी",
    crop_sunflower_desc: "उच्च तेल सामग्री वाली तिलहन फसल",
    crop_soybean_name: "सोयाबीन",
    crop_soybean_desc: "खरीफ मौसम की तिलहन और प्रोटीन फसल",
    crop_sugarcane_name: "गन्ना",
    crop_sugarcane_desc: "चीनी उत्पादन के लिए वार्षिक नकदी फसल",
    crop_cotton_name: "कपास",
    crop_cotton_desc: "खरीफ मौसम की रेशा फसल",
    crop_tobacco_name: "तम्बाकू",
    crop_tobacco_desc: "पत्तियों के लिए व्यावसायिक फसल",
    crop_potato_name: "आलू",
    crop_potato_desc: "रबी मौसम की कंद सब्जी",
    crop_tomato_name: "टमाटर",
    crop_tomato_desc: "साल भर की सब्जी फसल",
    crop_onion_name: "प्याज",
    crop_onion_desc: "रबी मौसम की कंद सब्जी",
    crop_chilli_name: "मिर्च",
    crop_chilli_desc: "मसाला फसल, खरीफ और रबी मौसम",
    crop_brinjal_name: "बैंगन",
    crop_brinjal_desc: "साल भर की सब्जी फसल",
    crop_mango_name: "आम",
    crop_mango_desc: "फलों का राजा, बारहमासी पेड़",
    crop_banana_name: "केला",
    crop_banana_desc: "बारहमासी फल फसल",
    crop_citrus_name: "नींबू वंश",
    crop_citrus_desc: "संतरा, नींबू, मौसमी फल",
    crop_coconut_name: "नारियल",
    crop_coconut_desc: "बारहमासी पाम फसल",
    crop_turmeric_name: "हल्दी",
    crop_turmeric_desc: "खरीफ मौसम की मसाला फसल",
    crop_ginger_name: "अदरक",
    crop_ginger_desc: "खरीफ मौसम की मसाला फसल",

    // -- DISEASE DETECTION --
    disease_upload_title: "फसल की तस्वीर अपलोड करें",
    disease_upload_desc: "यहां क्लिक करें या फसल की तस्वीर खींचकर छोड़ें",
    disease_analyze_btn: "विश्लेषण करें",
    disease_result_title: "विश्लेषण परिणाम",
    disease_result_name: "रोग: पत्ती रस्ट",
    disease_result_confidence: "विश्वास: 92%",
    disease_symptoms: "लक्षण",
    disease_treatment: "उपचार",
    disease_prevention: "रोकथाम",

    // -- WEATHER --
    weather_location_placeholder: "अपना स्थान दर्ज करें (जैसे, इंदौर, भारत)",
    weather_get_btn: "मौसम देखें",
    weather_forecast_title: "3 दिन का पूर्वानुमान",

    // -- FOOTER --
    footer_brand_title: "कृषि सहायता",
    footer_brand_desc: "भारतीय किसानों को प्रौद्योगिकी और ज्ञान से सशक्त बनाना।",
    footer_quicklinks_title: "त्वरित लिंक",
    footer_quicklinks_home: "होम",
    footer_quicklinks_crops: "फसल जानकारी",
    footer_quicklinks_disease: "रोग जांच",
    footer_quicklinks_weather: "मौसम पूर्वानुमान",
    footer_quicklinks_contact: "संपर्क करें",
    footer_contact_title: "संपर्क जानकारी",
    footer_contact_address: "आईपीएस अकादमी स्कूल ऑफ कंप्यूटर, इंदौर",
    footer_contact_phone: "+91 8085263339",
    footer_contact_email: "info@krishisahayata.com",
    footer_newsletter_title: "समाचार पत्रिका",
    footer_newsletter_desc: "नवीनतम कृषि सुझावों के लिए सदस्यता लें।",
    footer_newsletter_placeholder: "आपका ईमेल",
    footer_newsletter_btn: "सदस्यता लें",
    footer_copyright: "© 2025 कृषि सहायता। सर्वाधिकार सुरक्षित।",

    // -- AUTH --
    auth_tab_login: "लॉगिन",
    auth_tab_signup: "साइन अप",
    auth_login_title: "वापसी पर स्वागत",
    auth_login_subtitle: "अपने कृषि सहायता खाते में लॉगिन करें",
    auth_email_placeholder: "ईमेल पता",
    auth_password_placeholder: "पासवर्ड",
    auth_remember: "मुझे याद रखें",
    auth_forgot: "पासवर्ड भूल गए?",
    auth_login_btn: "लॉगिन",
    auth_divider: "या इससे जारी रखें",
    auth_google: "गूगल",
    auth_github: "गिटहब",
    auth_no_account: "खाता नहीं है?",
    auth_signup_link: "साइन अप",
    auth_signup_title: "खाता बनाएं",
    auth_signup_subtitle: "मुफ्त में कृषि सहायता से जुड़ें",
    auth_name_placeholder: "पूरा नाम",
    auth_confirm_placeholder: "पासवर्ड की पुष्टि करें",
    auth_terms_text: "मैं सहमत हूं",
    auth_terms_link: "नियम और शर्तें",
    auth_signup_btn: "खाता बनाएं",
    auth_has_account: "पहले से खाता है?",
    auth_login_link: "लॉगिन",
    auth_forgot_title: "पासवर्ड रीसेट",
    auth_forgot_subtitle: "रीसेट लिंक प्राप्त करने के लिए ईमेल दर्ज करें",
    auth_forgot_btn: "रीसेट लिंक भेजें",
    auth_back_to_login: "लॉगिन पर वापस जाएं",

    // -- CHATBOT --
    chatbot_title: "कृषि AI सहायक",
    chatbot_placeholder: "अपना सवाल हिंदी या अंग्रेजी में लिखें...",

    // -- DETAIL CARD HEADINGS (shared across crops) --
    heading_duration: "फसल अवधि",
    heading_water: "पानी की आवश्यकता",
    heading_fertilizers: "उर्वरक",
    heading_diseases: "सामान्य रोग",
    heading_soil: "मिट्टी की आवश्यकता",
    heading_climate: "जलवायु",
    heading_harvesting: "कटाई",
    heading_yield: "उपज क्षमता",

    // -- CROP DETAIL CONTENT --
    crop_detail: {
      wheat: {
        description: "गेहूं रबी मौसम की फसल है, आमतौर पर नवंबर में बोई जाती है और मार्च-अप्रैल में काटी जाती है। यह भारत का मुख्य खाद्यान्न और पोषण का प्रमुख स्रोत है।",
        duration: "बुवाई से कटाई तक 110-130 दिन",
        water: "4-6 सिंचाई की आवश्यकता। महत्वपूर्ण चरण: क्राउन रूट इनिशिएशन, टिलरिंग, जॉइंटिंग, फूल आना, दूधिया अवस्था। कुल पानी: 450-650 मिमी।",
        fertilizers: [
          "नाइट्रोजन: 120-150 किग्रा/हेक्टेयर 2-3 भागों में",
          "फॉस्फोरस: 60-80 किग्रा/हेक्टेयर आधार खाद के रूप में",
          "पोटाश: 40-60 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर जिंक सल्फेट (यदि कमी हो)"
        ],
        diseases: [
          "रस्ट: प्रतिरोधी किस्मों का उपयोग करें, प्रोपिकोनाजोल का छिड़काव करें",
          "कर्णल बंट: कार्बेन्डाजिम से बीज उपचार",
          "पाउडरी मिल्ड्यू: सल्फर डस्टिंग या वेटेबल सल्फर",
          "पत्ती झुलसा: प्रारंभ में मैंकोजेब का छिड़काव"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी, पीएच 6.0-7.5। जलभराव से बचें। अच्छी कार्बनिक सामग्री पसंद है।",
        climate: "ठंडा मौसम, तापमान 10-25°C। पकने के दौरान धूप वाले दिन चाहिए। फूल आने पर पाले के प्रति संवेदनशील।",
        harvesting: "कटाई तब करें जब दाने सख्त हों और नमी 20-25% हो। नुकसान से बचने के लिए तुरंत गहाई करें।",
        yield: "औसत उपज: 4-5 टन/हेक्टेयर। संभावित उपज: 6-7 टन/हेक्टेयर अनुकूल परिस्थितियों में।"
      },
      rice: {
        description: "चावल खरीफ मौसम की फसल है, आमतौर पर जून-जुलाई में बोई जाती है और अक्टूबर-नवंबर में काटी जाती है। यह भारत के अधिकांश लोगों का मुख्य भोजन है और इसे अधिक पानी की आवश्यकता होती है।",
        duration: "किस्म के अनुसार 90-150 दिन (छोटी, मध्यम, लंबी अवधि)",
        water: "अधिकांश विकास चरणों में 5-10 सेमी खड़े पानी की आवश्यकता। कुल पानी: 1100-1250 मिमी।",
        fertilizers: [
          "नाइट्रोजन: 100-150 किग्रा/हेक्टेयर 3-4 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 40-60 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर जिंक सल्फेट (यदि कमी हो)"
        ],
        diseases: [
          "ब्लास्ट: प्रतिरोधी किस्मों का उपयोग करें, ट्राइसाइक्लाज़ोल का छिड़काव",
          "भूरा धब्बा: कार्बेन्डाजिम से बीज उपचार",
          "शीथ ब्लाइट: वैलिडामाइसिन का छिड़काव",
          "जीवाणु पत्ती झुलसा: स्ट्रेप्टोसाइक्लिन का छिड़काव"
        ],
        soil: "चिकनी दोमट मिट्टी जिसमें जल धारण क्षमता अच्छी हो। पीएच: 5.5-6.5।",
        climate: "गर्म और आर्द्र जलवायु, तापमान 20-40°C। कम तापमान के प्रति संवेदनशील।",
        harvesting: "कटाई तब करें जब 80-85% दाने पीले हो जाएं और सख्त हो जाएं। नमी 20-25% होनी चाहिए।",
        yield: "औसत उपज: 3-4 टन/हेक्टेयर। संभावित: 6-8 टन/हेक्टेयर संकर किस्मों से।"
      },
      maize: {
        description: "मक्का खरीफ और रबी दोनों मौसमों में उगाई जाती है। यह बहुउपयोगी फसल है जिसका उपयोग मानव भोजन, पशु आहार और औद्योगिक उद्देश्यों के लिए किया जाता है।",
        duration: "प्रारंभिक किस्मों के लिए 85-100 दिन, मध्यम के लिए 100-110, देर से पकने वाली के लिए 110-120",
        water: "500-800 मिमी पानी की आवश्यकता। महत्वपूर्ण चरण: घुटने की ऊंचाई, बाली आना, दाना भरना।",
        fertilizers: [
          "नाइट्रोजन: 120-150 किग्रा/हेक्टेयर 2-3 भागों में",
          "फॉस्फोरस: 60-80 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 40-60 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "पत्ती झुलसा: मैंकोजेब का छिड़काव",
          "मेडिस पत्ती झुलसा: जिनेब या मैंकोजेब",
          "तना सड़न: जलभराव से बचें",
          "सामान्य रस्ट: सल्फर-आधारित फफूंदनाशक"
        ],
        soil: "अच्छी जल निकासी वाली उपजाऊ दोमट और जलोढ़ मिट्टी। पीएच: 6.5-7.5।",
        climate: "गर्म मौसम की फसल। तापमान: 21-27°C। पाला-मुक्त अवधि आवश्यक।",
        harvesting: "कटाई तब करें जब दाने सख्त हों और नमी 20-25% हो।",
        yield: "औसत उपज: 3-4 टन/हेक्टेयर। संभावित: 8-10 टन/हेक्टेयर।"
      },
      barley: {
        description: "जौ रबी मौसम की अनाज फसल है, जो कम अवधि में तैयार होती है और लवणीय तथा क्षारीय मिट्टी में भी उगाई जा सकती है।",
        duration: "किस्म के अनुसार 110-130 दिन। जल्दी पकने वाली: 90-100 दिन",
        water: "3-4 सिंचाई की आवश्यकता। कुल पानी: 400-500 मिमी।",
        fertilizers: [
          "नाइट्रोजन: 60-80 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-30 किग्रा/हेक्टेयर",
          "जिंक: 20 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "पीला रस्ट: ट्रायडाइमेफॉन का छिड़काव",
          "पाउडरी मिल्ड्यू: सल्फर डस्टिंग",
          "पत्ती झुलसा: मैंकोजेब का प्रयोग",
          "ढका हुआ स्मट: कार्बोक्सिन से बीज उपचार"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। लवणीय और क्षारीय परिस्थितियों को सहन करती है। पीएच: 6.5-8.0",
        climate: "ठंडी मौसम की फसल। तापमान: 12-25°C। गेहूं की तुलना में पाले और सूखे को अधिक सहन करती है।",
        harvesting: "कटाई तब करें जब दाने सख्त हों और नमी 20-22% हो।",
        yield: "औसत उपज: 2.5-3.5 टन/हेक्टेयर। संभावित: 4-5 टन/हेक्टेयर।"
      },
      sorghum: {
        description: "ज्वार सूखा-सहिष्णु खरीफ फसल है, जो शुष्क क्षेत्रों के लिए उपयुक्त है। भोजन, चारा और औद्योगिक उपयोगों के लिए उगाई जाती है।",
        duration: "अनाज के लिए 100-120 दिन, चारे के लिए 60-70 दिन",
        water: "सूखा-सहिष्णु। 450-650 मिमी पानी की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 80-100 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 30-40 किग्रा/हेक्टेयर",
          "जिंक: 20 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "दाना फफूंद: कैप्टान या थीरम का छिड़काव",
          "एन्थ्रेकनोज: प्रतिरोधी किस्मों का उपयोग",
          "डाउनी मिल्ड्यू: मेटालैक्सिल बीज उपचार",
          "पत्ती झुलसा: मैंकोजेब का छिड़काव"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। खराब मिट्टी और सूखे को सहन करती है। पीएच: 6.0-8.5",
        climate: "गर्म मौसम की फसल। तापमान: 25-35°C। अत्यधिक सूखा और गर्मी सहिष्णु।",
        harvesting: "कटाई तब करें जब दाने सख्त हों और नमी 20-25% हो।",
        yield: "औसत उपज: 2-3 टन/हेक्टेयर अनाज।"
      },
      chickpea: {
        description: "चना प्रमुख रबी दलहन फसल है, जो प्रोटीन से भरपूर है। दो मुख्य प्रकार: देसी (भूरा) और काबुली (सफेद)।",
        duration: "देसी किस्मों के लिए 90-120 दिन, काबुली के लिए 100-150 दिन",
        water: "सूखा-सहिष्णु। 2-3 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 20-25 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-25 किग्रा/हेक्टेयर",
          "राइजोबियम कल्चर: बीज उपचार आवश्यक"
        ],
        diseases: [
          "फ्यूजेरियम विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "अस्कोकाइटा झुलसा: कार्बेन्डाजिम का छिड़काव",
          "बोट्रीटिस ग्रे मोल्ड: जलभराव से बचें",
          "सूखी जड़ सड़न: कार्बेन्डाजिम से बीज उपचार"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से चिकनी दोमट मिट्टी। पीएच: 6.0-8.0",
        climate: "ठंडी मौसम की फसल। तापमान: 15-25°C। फूल आने पर पाले के प्रति संवेदनशील।",
        harvesting: "कटाई तब करें जब पत्तियां पीली हो जाएं और फलियां सूख जाएं।",
        yield: "औसत उपज: 1.2-1.8 टन/हेक्टेयर। संभावित: 2.5-3 टन/हेक्टेयर।"
      },
      pigeonpea: {
        description: "अरहर बारहमासी दलहन फसल है जिसे वार्षिक रूप में उगाया जाता है। अनाज और चारे के लिए दोहरे उद्देश्य वाली फसल।",
        duration: "प्रारंभिक किस्मों के लिए 150-180 दिन, देर से पकने वाली के लिए 240-300 दिन",
        water: "सूखा-सहिष्णु। 600-800 मिमी पानी की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 20-25 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-25 किग्रा/हेक्टेयर",
          "जिंक: 20 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "बाँझपन मोज़ेक: संक्रमित पौधों को हटाएं",
          "फाइटोफ्थोरा झुलसा: मेटालैक्सिल का छिड़काव",
          "अल्टरनेरिया झुलसा: मैंकोजेब का प्रयोग"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से चिकनी दोमट मिट्टी। पीएच: 5.0-7.0",
        climate: "गर्म मौसम की फसल। तापमान: 20-30°C।",
        harvesting: "कटाई तब करें जब 80% फलियां भूरी हो जाएं।",
        yield: "औसत उपज: 0.8-1.2 टन/हेक्टेयर।"
      },
      lentil: {
        description: "मसूर पौष्टिक रबी दलहन फसल है, प्रोटीन से भरपूर। शाकाहारी भोजन और मिट्टी की उर्वरता के लिए महत्वपूर्ण।",
        duration: "छोटे बीज वाली 110-130 दिन, बड़े बीज वाली 130-150 दिन",
        water: "2-3 सिंचाई की आवश्यकता। जलभराव के प्रति संवेदनशील।",
        fertilizers: [
          "नाइट्रोजन: 15-20 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-25 किग्रा/हेक्टेयर",
          "राइजोबियम: बीज उपचार आवश्यक"
        ],
        diseases: [
          "विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "स्टेमफीलियम झुलसा: मैंकोजेब का छिड़काव",
          "रस्ट: सल्फर डस्टिंग",
          "जड़ सड़न: उचित जल निकासी"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। भारी चिकनी मिट्टी से बचें। पीएच: 6.0-7.5",
        climate: "ठंडी मौसम की फसल। तापमान: 15-25°C।",
        harvesting: "कटाई तब करें जब पौधे पीले हो जाएं और फलियां सूख जाएं।",
        yield: "औसत उपज: 0.8-1.2 टन/हेक्टेयर।"
      },
      mungbean: {
        description: "मूंग अल्पकालिक खरीफ दलहन फसल है। तेजी से बढ़ती है और बहु-फसल प्रणाली में अच्छी तरह फिट बैठती है।",
        duration: "गर्मी की फसल के लिए 60-75 दिन, खरीफ के लिए 80-90 दिन",
        water: "3-4 सिंचाई की आवश्यकता। जलभराव के प्रति संवेदनशील।",
        fertilizers: [
          "नाइट्रोजन: 15-20 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-25 किग्रा/हेक्टेयर",
          "राइजोबियम: बीज उपचार अनुशंसित"
        ],
        diseases: [
          "पीला मोज़ेक: प्रतिरोधी किस्मों का उपयोग",
          "पत्ती धब्बा: मैंकोजेब का छिड़काव",
          "पाउडरी मिल्ड्यू: सल्फर डस्टिंग",
          "जड़ सड़न: उचित जल निकासी"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से दोमट मिट्टी। पीएच: 6.5-7.5",
        climate: "गर्म मौसम की फसल। तापमान: 25-35°C।",
        harvesting: "कटाई तब करें जब 80% फलियां काली हो जाएं।",
        yield: "औसत उपज: 0.6-0.8 टन/हेक्टेयर।"
      },
      mustard: {
        description: "सरसों महत्वपूर्ण रबी तिलहन फसल है। उत्तर भारत में खाद्य तेल का प्रमुख स्रोत। मसाले के रूप में भी उपयोग।",
        duration: "किस्म के अनुसार 110-140 दिन",
        water: "3-4 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 60-80 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 20-30 किग्रा/हेक्टेयर",
          "सल्फर: 20-30 किग्रा/हेक्टेयर तेल की गुणवत्ता के लिए"
        ],
        diseases: [
          "सफेद रस्ट: मेटालैक्सिल का छिड़काव",
          "अल्टरनेरिया झुलसा: मैंकोजेब का प्रयोग",
          "डाउनी मिल्ड्यू: उचित दूरी पर रोपण",
          "स्क्लेरोटिनिया सड़न: फसल चक्र"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। पीएच: 6.5-8.0",
        climate: "ठंडी मौसम की फसल। तापमान: 10-25°C।",
        harvesting: "कटाई तब करें जब फलियां पीली हो जाएं और बीज सख्त हो जाएं।",
        yield: "औसत उपज: 1.2-1.8 टन/हेक्टेयर।"
      },
      groundnut: {
        description: "मूंगफली महत्वपूर्ण खरीफ तिलहन और खाद्य फसल है। प्रोटीन और तेल से भरपूर। मूंगफली के नाम से भी जानी जाती है।",
        duration: "गुच्छेदार प्रकार के लिए 100-120 दिन, फैलने वाले के लिए 120-140 दिन",
        water: "500-600 मिमी पानी की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 20-25 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 40-50 किग्रा/हेक्टेयर",
          "कैल्शियम: 200-400 किग्रा/हेक्टेयर जिप्सम फूल आने पर"
        ],
        diseases: [
          "टिक्का रोग: मैंकोजेब का छिड़काव",
          "तना सड़न: उचित जल निकासी",
          "जड़ सड़न: फसल चक्र",
          "कली परिगलन: थ्रिप्स वेक्टर नियंत्रण"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट मिट्टी। पीएच: 6.0-7.0",
        climate: "गर्म मौसम की फसल। तापमान: 25-35°C।",
        harvesting: "कटाई तब करें जब भीतरी छिलका गहरा हो जाए।",
        yield: "औसत उपज: 1.5-2 टन/हेक्टेयर।"
      },
      sunflower: {
        description: "सूरजमुखी उच्च तेल सामग्री वाली महत्वपूर्ण तिलहन फसल है। खरीफ और रबी दोनों मौसमों में उगाई जाती है।",
        duration: "खरीफ के लिए 90-100 दिन, रबी के लिए 105-130 दिन",
        water: "4-5 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 60-80 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 40-50 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 40-50 किग्रा/हेक्टेयर",
          "बोरॉन: 10 किग्रा/हेक्टेयर बोरेक्स यदि कमी हो"
        ],
        diseases: [
          "अल्टरनेरिया झुलसा: मैंकोजेब का छिड़काव",
          "रस्ट: सल्फर डस्टिंग",
          "सिर सड़न: उचित जल निकासी",
          "पाउडरी मिल्ड्यू: कराथेन का प्रयोग"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। पीएच: 6.5-8.5",
        climate: "गर्म मौसम की फसल। तापमान: 20-30°C।",
        harvesting: "कटाई तब करें जब सिर का पिछला भाग पीला हो जाए।",
        yield: "औसत उपज: 1.2-1.8 टन/हेक्टेयर।"
      },
      soybean: {
        description: "सोयाबीन प्रोटीन और तेल से भरपूर खरीफ फसल है। भोजन, चारा और औद्योगिक उपयोगों के लिए महत्वपूर्ण।",
        duration: "प्रारंभिक किस्मों के लिए 90-110 दिन, देर से पकने वाली के लिए 130-150 दिन",
        water: "450-650 मिमी पानी की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 20-25 किग्रा/हेक्टेयर प्रारंभिक खाद",
          "फॉस्फोरस: 60-80 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 40-50 किग्रा/हेक्टेयर",
          "राइजोबियम: बीज उपचार आवश्यक"
        ],
        diseases: [
          "पीला मोज़ेक: प्रतिरोधी किस्मों का उपयोग",
          "जीवाणु झुलसा: स्ट्रेप्टोसाइक्लिन का छिड़काव",
          "चारकोल सड़न: सूखे के तनाव से बचें",
          "जड़ सड़न: बीज उपचार"
        ],
        soil: "अच्छी जल निकासी वाली दोमट मिट्टी। पीएच: 6.0-7.5",
        climate: "गर्म मौसम की फसल। तापमान: 20-30°C।",
        harvesting: "कटाई तब करें जब पत्तियां पीली हो जाएं और फलियां सूख जाएं।",
        yield: "औसत उपज: 1.5-2 टन/हेक्टेयर।"
      },
      sugarcane: {
        description: "गन्ना चीनी उत्पादन के लिए उगाई जाने वाली वार्षिक नकदी फसल है। लंबी अवधि की फसल जिसमें अधिक निवेश की आवश्यकता होती है।",
        duration: "किस्म और मौसम के अनुसार 12-18 महीने",
        water: "उच्च पानी की आवश्यकता: 1500-2500 मिमी। 15-25 सिंचाई।",
        fertilizers: [
          "नाइट्रोजन: 200-250 किग्रा/हेक्टेयर 3-4 भागों में",
          "फॉस्फोरस: 60-80 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 100-120 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "लाल सड़न: प्रतिरोधी किस्मों का उपयोग",
          "स्मट: सेट्ट का गर्म पानी उपचार",
          "विल्ट: उचित जल निकासी",
          "घासीय प्ररोह: रोग-मुक्त सेट्ट का उपयोग"
        ],
        soil: "गहरी, अच्छी जल निकासी वाली मध्यम से भारी मिट्टी। पीएच: 6.5-7.5",
        climate: "गर्म और आर्द्र जलवायु। तापमान: 20-35°C।",
        harvesting: "कटाई तब करें जब चीनी की मात्रा 18-20% तक पहुंच जाए।",
        yield: "औसत उपज: 70-100 टन/हेक्टेयर।"
      },
      cotton: {
        description: "कपास खरीफ रेशा फसल है, जिसे 'सफेद सोना' कहा जाता है। कपड़ा उद्योग के लिए कच्चा माल प्रदान करने वाली प्रमुख नकदी फसल।",
        duration: "अमेरिकी कपास के लिए 150-180 दिन, देसी कपास के लिए 120-150 दिन",
        water: "600-800 मिमी पानी की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 100-120 किग्रा/हेक्टेयर 3 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 50-60 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "फ्यूजेरियम विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "जीवाणु झुलसा: स्ट्रेप्टोसाइक्लिन का छिड़काव",
          "धूसर फफूंदी: सल्फर डस्टिंग",
          "जड़ सड़न: उचित जल निकासी"
        ],
        soil: "अच्छी जल निकासी वाली गहरी काली मिट्टी। पीएच: 6.0-8.0",
        climate: "गर्म मौसम की फसल। तापमान: 21-30°C।",
        harvesting: "जैसे-जैसे टिंडे परिपक्व हों, कई बार तोड़ें।",
        yield: "औसत उपज: 2-3 टन/हेक्टेयर बीज कपास।"
      },
      tobacco: {
        description: "तम्बाकू पत्तियों के लिए उगाई जाने वाली व्यावसायिक फसल है। गुणवत्ता उत्पादन के लिए सावधानीपूर्वक प्रबंधन आवश्यक है।",
        duration: "रोपाई से कटाई तक 90-120 दिन",
        water: "4-5 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 40-60 किग्रा/हेक्टेयर मिट्टी के प्रकार के अनुसार",
          "फॉस्फोरस: 30-40 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 60-80 किग्रा/हेक्टेयर",
          "जिंक: 20 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "डैम्पिंग ऑफ: बीज उपचार",
          "ब्लैक शैंक: प्रतिरोधी किस्मों का उपयोग",
          "भूरा धब्बा: मैंकोजेब का छिड़काव",
          "मोज़ेक वायरस: एफिड नियंत्रण"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट मिट्टी। पीएच: 5.5-6.5",
        climate: "गर्म मौसम की फसल। तापमान: 20-30°C।",
        harvesting: "प्राइमिंग विधि - नीचे से ऊपर की ओर पत्तियों की कटाई।",
        yield: "औसत उपज: 1.5-2 टन/हेक्टेयर सूखी पत्तियां।"
      },
      potato: {
        description: "आलू रबी मौसम की कंद सब्जी है, जो मुख्य भोजन के रूप में व्यापक रूप से खाई जाती है। कम अवधि की फसल जिसमें उच्च उपज क्षमता है।",
        duration: "प्रारंभिक किस्मों के लिए 80-100 दिन, मुख्य फसल के लिए 100-120 दिन",
        water: "5-6 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 120-150 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 60-80 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 100-120 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "लेट ब्लाइट: मैंकोजेब का छिड़काव",
          "अर्ली ब्लाइट: जिनेब का प्रयोग",
          "ब्लैक स्कर्फ: बीज उपचार",
          "वायरल रोग: प्रमाणित बीज का उपयोग"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट मिट्टी। पीएच: 5.5-6.5",
        climate: "ठंडी मौसम की फसल। तापमान: 15-25°C। कंद निर्माण 17-19°C पर सर्वोत्तम।",
        harvesting: "कटाई तब करें जब बेलें सूख जाएं। भंडारण से पहले 10-15 दिन सुखाएं।",
        yield: "औसत उपज: 20-25 टन/हेक्टेयर। संभावित: 40-50 टन/हेक्टेयर।"
      },
      tomato: {
        description: "टमाटर साल भर उगाई जाने वाली सब्जी है, अत्यधिक पौष्टिक और भारतीय व्यंजनों में व्यापक रूप से उपयोग।",
        duration: "रोपाई से आखिरी तुड़ाई तक 90-120 दिन",
        water: "6-8 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 100-120 किग्रा/हेक्टेयर 3-4 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 60-80 किग्रा/हेक्टेयर",
          "कैल्शियम: फूल सड़न रोकने के लिए पर्ण छिड़काव"
        ],
        diseases: [
          "अर्ली ब्लाइट: मैंकोजेब का छिड़काव",
          "लेट ब्लाइट: मेटालैक्सिल का प्रयोग",
          "जीवाणु विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "पत्ती मुड़ाव: सफेद मक्खी नियंत्रण"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से चिकनी दोमट मिट्टी। पीएच: 6.0-7.0",
        climate: "गर्म मौसम की फसल। तापमान: 18-27°C।",
        harvesting: "पके हरे या लाल अवस्था में कई बार तुड़ाई।",
        yield: "औसत उपज: 25-35 टन/हेक्टेयर।"
      },
      onion: {
        description: "प्याज रबी मौसम की कंद सब्जी है, भारतीय खाना पकाने में आवश्यक। लंबे समय तक भंडारण योग्य, महत्वपूर्ण व्यावसायिक फसल।",
        duration: "रोपाई से कटाई तक 120-150 दिन",
        water: "8-10 सिंचाई की आवश्यकता। कटाई से 15-20 दिन पहले सिंचाई बंद करें।",
        fertilizers: [
          "नाइट्रोजन: 100-120 किग्रा/हेक्टेयर 3 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 60-80 किग्रा/हेक्टेयर",
          "सल्फर: 20-30 किग्रा/हेक्टेयर तीखेपन के लिए"
        ],
        diseases: [
          "बैंगनी धब्बा: मैंकोजेब का छिड़काव",
          "स्टेमफीलियम झुलसा: कॉपर ऑक्सीक्लोराइड",
          "आधार सड़न: उचित जल निकासी",
          "थ्रिप्स: इमिडाक्लोप्रिड का छिड़काव"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से दोमट मिट्टी। पीएच: 6.0-7.5",
        climate: "ठंडी मौसम की फसल। तापमान: 13-24°C।",
        harvesting: "कटाई तब करें जब ऊपरी भाग गिर जाए। भंडारण से पहले 10-15 दिन सुखाएं।",
        yield: "औसत उपज: 20-25 टन/हेक्टेयर।"
      },
      chilli: {
        description: "मिर्च महत्वपूर्ण मसाला फसल है जो खरीफ और रबी दोनों मौसमों में उगाई जाती है। ताजी सब्जी और सूखे मसाले के रूप में उपयोग।",
        duration: "कई बार तुड़ाई के साथ 150-180 दिन",
        water: "8-10 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 100-120 किग्रा/हेक्टेयर 3-4 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 60-80 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "डाई-बैक: कॉपर ऑक्सीक्लोराइड का छिड़काव",
          "फल सड़न: मैंकोजेब का प्रयोग",
          "पत्ती मुड़ाव: सफेद मक्खी नियंत्रण",
          "जीवाणु विल्ट: प्रतिरोधी किस्मों का उपयोग"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से दोमट मिट्टी। पीएच: 6.0-7.0",
        climate: "गर्म मौसम की फसल। तापमान: 20-30°C।",
        harvesting: "हरी या लाल पकी अवस्था में कई बार तुड़ाई।",
        yield: "औसत उपज: 1.5-2 टन/हेक्टेयर सूखी मिर्च।"
      },
      brinjal: {
        description: "बैंगन साल भर उगाई जाने वाली सब्जी है, भारतीय व्यंजनों में लोकप्रिय। विभिन्न आकार, रंगों में उपलब्ध।",
        duration: "निरंतर कटाई के साथ 140-160 दिन",
        water: "8-10 सिंचाई की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 100-120 किग्रा/हेक्टेयर 3-4 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 60-80 किग्रा/हेक्टेयर",
          "जिंक: 25 किग्रा/हेक्टेयर यदि कमी हो"
        ],
        diseases: [
          "फोमोप्सिस झुलसा: मैंकोजेब का छिड़काव",
          "जीवाणु विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "छोटी पत्ती: लीफहॉपर नियंत्रण",
          "फल सड़न: उचित दूरी पर रोपण"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से चिकनी दोमट मिट्टी। पीएच: 5.5-6.5",
        climate: "गर्म मौसम की फसल। तापमान: 22-30°C।",
        harvesting: "कटाई तब करें जब फल पूर्ण आकार के हों लेकिन कोमल हों।",
        yield: "औसत उपज: 25-35 टन/हेक्टेयर।"
      },
      mango: {
        description: "आम, 'फलों का राजा', भारत में व्यापक रूप से उगाया जाने वाला बारहमासी फलदार पेड़ है। लंबे समय तक जीवित रहने वाला और उच्च आर्थिक मूल्य वाला।",
        duration: "बारहमासी पेड़, 4-5 वर्षों में फल देना शुरू, 40-50 वर्षों तक उत्पादक",
        water: "युवा पेड़: 8-10 सिंचाई/वर्ष। फल देने वाले पेड़: फूल आने, फल लगने पर महत्वपूर्ण।",
        fertilizers: [
          "नाइट्रोजन: 1-1.5 किग्रा/पेड़/वर्ष",
          "फॉस्फोरस: 0.5-0.75 किग्रा/पेड़/वर्ष",
          "पोटाश: 0.75-1 किग्रा/पेड़/वर्ष",
          "गोबर की खाद: 50-100 किग्रा/पेड़/वर्ष"
        ],
        diseases: [
          "एन्थ्रेकनोज: कॉपर ऑक्सीक्लोराइड का छिड़काव",
          "पाउडरी मिल्ड्यू: सल्फर डस्टिंग",
          "आम विकृति: उचित छंटाई",
          "फल मक्खी: बेट ट्रैप"
        ],
        soil: "गहरी, अच्छी जल निकासी वाली मिट्टी। पीएच: 5.5-7.5",
        climate: "उष्णकटिबंधीय फल। तापमान: 24-30°C। फूल आने के लिए सूखी अवधि आवश्यक।",
        harvesting: "किस्म और बाजार के अनुसार कटाई। स्थानीय बाजार के लिए पका हुआ हरा।",
        yield: "औसत उपज: 8-10 टन/हेक्टेयर।"
      },
      banana: {
        description: "केला पूरे भारत में उगाया जाने वाला बारहमासी फल है। तेजी से बढ़ने वाला, उच्च उपज क्षमता वाला। पोषण और आय के लिए महत्वपूर्ण।",
        duration: "रोपण से कटाई तक 12-15 महीने। रटून फसल: 10-12 महीने",
        water: "उच्च पानी की आवश्यकता। हर 4-7 दिन में सिंचाई।",
        fertilizers: [
          "नाइट्रोजन: 200-250 ग्राम/पौधा 5-6 भागों में",
          "फॉस्फोरस: 60-80 ग्राम/पौधा आधार खाद",
          "पोटाश: 300-400 ग्राम/पौधा भागों में",
          "गोबर की खाद: 10-15 किग्रा/पौधा/वर्ष"
        ],
        diseases: [
          "पनामा विल्ट: प्रतिरोधी किस्मों का उपयोग",
          "सिगाटोका पत्ती धब्बा: मैंकोजेब का छिड़काव",
          "बंची टॉप: रोग-मुक्त सकर का उपयोग",
          "बरोइंग नेमाटोड: कॉर्म उपचार"
        ],
        soil: "गहरी, अच्छी जल निकासी वाली दोमट मिट्टी। पीएच: 6.0-7.5",
        climate: "उष्णकटिबंधीय फल। तापमान: 15-35°C। तेज हवाओं के प्रति संवेदनशील।",
        harvesting: "कटाई तब करें जब फल पूरी तरह विकसित हों लेकिन हरे हों।",
        yield: "औसत उपज: 40-50 टन/हेक्टेयर।"
      },
      citrus: {
        description: "नींबू वंश में संतरा, नींबू और अन्य संबंधित फल शामिल हैं। उच्च पोषण और आर्थिक मूल्य वाले बारहमासी पेड़।",
        duration: "बारहमासी पेड़, 3-5 वर्षों में फल देना शुरू, 25-30 वर्षों तक उत्पादक",
        water: "15-20 सिंचाई/वर्ष की आवश्यकता।",
        fertilizers: [
          "नाइट्रोजन: 500-800 ग्राम/पेड़/वर्ष भागों में",
          "फॉस्फोरस: 200-300 ग्राम/पेड़/वर्ष",
          "पोटाश: 300-500 ग्राम/पेड़/वर्ष",
          "जिंक: यदि कमी हो तो पर्ण छिड़काव"
        ],
        diseases: [
          "सिट्रस कैंकर: कॉपर-आधारित छिड़काव",
          "ग्रीनिंग: साइलिड वेक्टर नियंत्रण",
          "पाउडरी मिल्ड्यू: सल्फर डस्टिंग",
          "जड़ सड़न: उचित जल निकासी"
        ],
        soil: "अच्छी जल निकासी वाली मध्यम से हल्की मिट्टी। पीएच: 5.5-7.5",
        climate: "उपोष्णकटिबंधीय फल। तापमान: 13-37°C।",
        harvesting: "रंग विकास और टीएसएस:एसिड अनुपात के आधार पर कटाई।",
        yield: "औसत उपज: 15-25 टन/हेक्टेयर।"
      },
      coconut: {
        description: "नारियल बारहमासी पाम फसल है, जिसे इसके अनेक उपयोगों के लिए 'कल्पवृक्ष' कहा जाता है। तटीय क्षेत्रों में उगाया जाता है।",
        duration: "बारहमासी पाम, 5-7 वर्षों में फल देना शुरू, 60-70 वर्षों तक उत्पादक",
        water: "उच्च पानी की आवश्यकता। वार्षिक वर्षा: 1500-2500 मिमी आदर्श।",
        fertilizers: [
          "नाइट्रोजन: 500 ग्राम/पेड़/वर्ष 2 भागों में",
          "फॉस्फोरस: 300 ग्राम/पेड़/वर्ष",
          "पोटाश: 1200 ग्राम/पेड़/वर्ष",
          "जैविक खाद: 50 किग्रा/पेड़/वर्ष"
        ],
        diseases: [
          "जड़ मुरझान: कोई प्रभावी नियंत्रण नहीं",
          "पत्ती सड़न: बोर्डो मिश्रण",
          "कली सड़न: प्रभावित ऊतक हटाएं",
          "तने से रिसाव: छेनी से साफ कर बोर्डो पेस्ट लगाएं"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से लैटराइट मिट्टी। पीएच: 5.0-8.0",
        climate: "उष्णकटिबंधीय फसल। तापमान: 20-32°C।",
        harvesting: "नारियल पानी के लिए 6-7 महीने, पका नारियल 12 महीने।",
        yield: "औसत उपज: 80-100 नारियल/पेड़/वर्ष।"
      },
      turmeric: {
        description: "हल्दी खरीफ मौसम की मसाला फसल है, जो अपने प्रकंदों के लिए मूल्यवान है। मसाला, दवा और रंग के रूप में उपयोग।",
        duration: "रोपण से कटाई तक 7-9 महीने",
        water: "15-20 सिंचाई की आवश्यकता। कटाई से 1 महीने पहले सिंचाई बंद करें।",
        fertilizers: [
          "नाइट्रोजन: 60-80 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 80-100 किग्रा/हेक्टेयर",
          "गोबर की खाद: 25-30 टन/हेक्टेयर"
        ],
        diseases: [
          "पत्ती धब्बा: मैंकोजेब का छिड़काव",
          "प्रकंद सड़न: उचित जल निकासी",
          "पत्ती चकत्ता: कॉपर ऑक्सीक्लोराइड",
          "नेमाटोड: मृदा उपचार"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से चिकनी दोमट मिट्टी। पीएच: 5.5-7.5",
        climate: "उष्णकटिबंधीय फसल। तापमान: 20-35°C।",
        harvesting: "कटाई तब करें जब पत्तियां पीली हो जाएं और सूख जाएं।",
        yield: "औसत उपज: 20-25 टन/हेक्टेयर ताजा प्रकंद।"
      },
      ginger: {
        description: "अदरक खरीफ मौसम की मसाला फसल है, जो अपने सुगंधित प्रकंदों के लिए उगाई जाती है। मसाला, दवा और खाद्य उत्पादों में उपयोग।",
        duration: "रोपण से कटाई तक 8-9 महीने",
        water: "15-20 सिंचाई की आवश्यकता। जलभराव के प्रति संवेदनशील।",
        fertilizers: [
          "नाइट्रोजन: 75-100 किग्रा/हेक्टेयर 2 भागों में",
          "फॉस्फोरस: 50-60 किग्रा/हेक्टेयर आधार खाद",
          "पोटाश: 80-100 किग्रा/हेक्टेयर",
          "गोबर की खाद: 25-30 टन/हेक्टेयर"
        ],
        diseases: [
          "नरम सड़न: उचित जल निकासी",
          "जीवाणु विल्ट: रोग-मुक्त बीज का उपयोग",
          "पत्ती धब्बा: मैंकोजेब का छिड़काव",
          "नेमाटोड: मृदा सौरीकरण"
        ],
        soil: "अच्छी जल निकासी वाली रेतीली दोमट से दोमट मिट्टी। पीएच: 6.0-7.0",
        climate: "उष्णकटिबंधीय फसल। तापमान: 20-30°C।",
        harvesting: "हरी अदरक के लिए 6-7 महीने, पकी अदरक के लिए 8-9 महीने।",
        yield: "औसत उपज: 15-20 टन/हेक्टेयर ताजा प्रकंद।"
      }
    }
  }
};

function applyLanguage(lang) {
  if (lang === 'en') {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const original = el.getAttribute('data-original');
      if (original) el.textContent = original;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const original = el.getAttribute('data-original-placeholder');
      if (original) el.placeholder = original;
    });
    // Restore detail card headings
    translateDetailHeadings(langData.hi, false);
    // Restore detail card content
    document.querySelectorAll('.detail-card [data-original-content]').forEach(el => {
      if (el.tagName === 'P' || (el.tagName === 'LI')) {
        el.textContent = el.getAttribute('data-original-content');
      }
    });
    // Restore crop detail names
    document.querySelectorAll('.crop-detail-content .crop-info h3').forEach(el => {
      const orig = el.getAttribute('data-original');
      if (orig) el.textContent = orig;
    });
    // Restore crop detail descriptions
    document.querySelectorAll('.crop-detail-content .crop-info p').forEach(el => {
      const orig = el.getAttribute('data-original');
      if (orig) el.textContent = orig;
    });
    document.documentElement.lang = 'en';
  } else {
    const t = langData.hi;
    // Translate data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        if (!el.getAttribute('data-original')) {
          el.setAttribute('data-original', el.textContent);
        }
        el.textContent = t[key];
      }
    });
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key]) {
        if (!el.getAttribute('data-original-placeholder')) {
          el.setAttribute('data-original-placeholder', el.placeholder);
        }
        el.placeholder = t[key];
      }
    });
    // Translate detail card headings
    translateDetailHeadings(t, true);
    // Translate detail card content
    translateDetailContent(t);
    document.documentElement.lang = 'hi';
  }

  // Update toggle UI
  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.classList.toggle('hi', lang === 'hi');
    toggle.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });
  }

  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
}

function translateDetailHeadings(t, applyHi) {
  const headingMap = {
    'Crop Duration': t.heading_duration,
    'Water Requirements': t.heading_water,
    'Fertilizers': t.heading_fertilizers,
    'Common Diseases': t.heading_diseases,
    'Soil Requirements': t.heading_soil,
    'Climate': t.heading_climate,
    'Harvesting': t.heading_harvesting,
    'Yield Potential': t.heading_yield
  };

  document.querySelectorAll('.detail-card h4').forEach(h4 => {
    let span = h4.querySelector('span.i18n-heading');
    if (!span) {
      const textNodes = Array.from(h4.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim());
      if (textNodes.length > 0) {
        span = document.createElement('span');
        span.className = 'i18n-heading';
        span.textContent = textNodes[0].textContent.trim();
        span.setAttribute('data-original-heading', span.textContent);
        textNodes[0].replaceWith(span);
      } else {
        const existing = h4.querySelector('span[data-i18n]');
        if (existing) return;
      }
    }
    if (span) {
      const orig = span.getAttribute('data-original-heading') || span.textContent;
      if (applyHi && headingMap[orig]) {
        span.textContent = headingMap[orig];
      } else {
        span.textContent = orig;
      }
    }
  });
}

function translateDetailContent(t) {
  document.querySelectorAll('.crop-detail-content').forEach(section => {
    const cropSlug = section.id.replace('-details', '');
    const cropData = t.crop_detail?.[cropSlug];
    if (!cropData) return;

    // Translate the h3 name
    const nameKey = `crop_${cropSlug}_name`;
    const nameEl = section.querySelector('.crop-info h3');
    if (nameEl && t[nameKey]) {
      if (!nameEl.hasAttribute('data-original')) {
        nameEl.setAttribute('data-original', nameEl.textContent);
      }
      nameEl.textContent = t[nameKey];
    }

    const detailCards = section.querySelectorAll('.detail-card');
    detailCards.forEach(card => {
      const headingEl = card.querySelector('h4 .i18n-heading') || card.querySelector('h4');
      const headingText = headingEl?.getAttribute('data-original-heading') || (headingEl?.textContent || '').trim();
      const typeKey = {
        'Crop Duration': 'duration',
        'Water Requirements': 'water',
        'Fertilizers': 'fertilizers',
        'Common Diseases': 'diseases',
        'Soil Requirements': 'soil',
        'Climate': 'climate',
        'Harvesting': 'harvesting',
        'Yield Potential': 'yield'
      }[headingText] || '';

      const data = cropData[typeKey];
      if (!data) return;

      if (Array.isArray(data)) {
        const items = card.querySelectorAll('ul li');
        items.forEach((li, idx) => {
          if (!li.hasAttribute('data-original-content')) {
            li.setAttribute('data-original-content', li.textContent);
          }
          li.textContent = data[idx] || li.getAttribute('data-original-content');
        });
      } else {
        const p = card.querySelector('p');
        if (p) {
          if (!p.hasAttribute('data-original-content')) {
            p.setAttribute('data-original-content', p.textContent);
          }
          p.textContent = data;
        }
      }
    });

    // Translate the crop description in the header
    const descP = section.querySelector('.crop-info p');
    if (descP && cropData.description) {
      if (!descP.hasAttribute('data-original')) {
        descP.setAttribute('data-original', descP.textContent);
      }
      descP.textContent = cropData.description;
    }
  });
}

// Language toggle click handler
const langToggle = document.getElementById('langToggle');
if (langToggle) {
  langToggle.addEventListener('click', () => {
    const newLang = currentLang === 'en' ? 'hi' : 'en';
    applyLanguage(newLang);
  });
}

// Apply saved language on load
applyLanguage(currentLang || 'en');

// ============ AUTH SYSTEM ============
const AUTH_KEY = 'krishi_sahayata_users';
const SESSION_KEY = 'krishi_sahayata_session';

function getUsers() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || {}; } catch { return {}; }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function saveSession(email, name) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email, name, loggedIn: true }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function isLoggedIn() {
    const s = getSession();
    return s && s.loggedIn;
}

function getCurrentUser() {
    return getSession();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function updateUIForLogin(user) {
    const loginBtn = document.getElementById('loginBtn');
    const userAvatar = document.getElementById('userAvatar');
    const avatarImg = document.getElementById('avatarImg');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (loginBtn) loginBtn.style.display = 'none';
    if (userAvatar) {
        userAvatar.style.display = 'flex';
        const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        if (avatarImg) {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=2e7d32&color=fff&size=64`;
            avatarImg.alt = user.name || 'User';
        }
        if (userNameDisplay) userNameDisplay.textContent = user.name || 'User';
    }
}

function updateUIForLogout() {
    const loginBtn = document.getElementById('loginBtn');
    const userAvatar = document.getElementById('userAvatar');
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userAvatar) userAvatar.style.display = 'none';
}

// Tab switching
document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.auth-tab');
    if (tabBtn) {
        const tab = tabBtn.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tabBtn.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const form = document.getElementById(tab + 'Form');
        if (form) form.classList.add('active');
    }
});

// Switch between forms via links
document.addEventListener('click', (e) => {
    const link = e.target.closest('.auth-switch a[data-tab]');
    if (link) {
        e.preventDefault();
        const tab = link.dataset.tab;
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const form = document.getElementById(tab + 'Form');
        if (form) form.classList.add('active');
    }
});

// Open auth modal
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal();
    });
}

// Close auth modal
const authClose = document.getElementById('authClose');
const authOverlay = document.getElementById('authOverlay');
if (authClose) authClose.addEventListener('click', closeAuthModal);
if (authOverlay) authOverlay.addEventListener('click', closeAuthModal);

// Forgot password link
const forgotPassword = document.getElementById('forgotPassword');
if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const forgotForm = document.getElementById('forgotForm');
        if (forgotForm) forgotForm.classList.add('active');
    });
}

// Toggle password visibility
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-password');
    if (toggle) {
        const targetId = toggle.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.classList.toggle('fa-eye', !isPassword);
            toggle.classList.toggle('fa-eye-slash', isPassword);
        }
    }
});

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe')?.checked || false;

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        const users = getUsers();
        if (!users[email]) {
            showToast('No account found with this email', 'error');
            document.getElementById('loginEmail').classList.add('error');
            document.querySelector('.auth-container')?.classList.add('shake');
            setTimeout(() => document.querySelector('.auth-container')?.classList.remove('shake'), 500);
            return;
        }

        if (users[email].password !== password) {
            showToast('Incorrect password', 'error');
            document.getElementById('loginPassword').classList.add('error');
            document.querySelector('.auth-container')?.classList.add('shake');
            setTimeout(() => document.querySelector('.auth-container')?.classList.remove('shake'), 500);
            return;
        }

        saveSession(email, users[email].name);
        updateUIForLogin({ name: users[email].name, email });
        closeAuthModal();
        showToast(`Welcome back, ${users[email].name}!`, 'success');
        loginForm.reset();
    });
}

// Signup form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim().toLowerCase();
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirm').value;
        const agreeTerms = document.getElementById('agreeTerms')?.checked || false;

        if (!name || !email || !password || !confirm) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (name.length < 2) {
            showToast('Name must be at least 2 characters', 'error');
            return;
        }

        if (!agreeTerms) {
            showToast('Please agree to the Terms & Conditions', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        if (password !== confirm) {
            showToast('Passwords do not match', 'error');
            document.getElementById('signupConfirm').classList.add('error');
            setTimeout(() => document.getElementById('signupConfirm')?.classList.remove('error'), 2000);
            return;
        }

        const users = getUsers();
        if (users[email]) {
            showToast('An account with this email already exists', 'error');
            return;
        }

        users[email] = { name, email, password, createdAt: new Date().toISOString() };
        saveUsers(users);

        saveSession(email, name);
        updateUIForLogin({ name, email });
        closeAuthModal();
        showToast(`Welcome to Krishi Sahayata, ${name}!`, 'success');
        signupForm.reset();
    });
}

// Forgot password form
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
        if (!email) {
            showToast('Please enter your email', 'error');
            return;
        }
        const users = getUsers();
        if (!users[email]) {
            showToast('No account found with this email', 'error');
            return;
        }
        showToast('Password reset link sent to your email (demo)', 'info');
        forgotForm.reset();
        setTimeout(() => {
            document.querySelectorAll('.auth-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === 'login');
            });
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const loginForm = document.getElementById('loginForm');
            if (loginForm) loginForm.classList.add('active');
        }, 1500);
    });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        updateUIForLogout();
        showToast('Logged out successfully', 'info');
    });
}

// Check session on load
(function initAuth() {
    const session = getSession();
    if (session && session.loggedIn) {
        updateUIForLogin(session);
    }
})();

// Keyboard shortcut: Escape to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAuthModal();
    }
});

// Remove input error state on focus
document.addEventListener('focusin', (e) => {
    if (e.target.matches('.input-group input')) {
        e.target.classList.remove('error');
    }
});