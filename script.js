 // Crop Selection Functionality
        document.querySelectorAll('.crop-card').forEach(card => {
            card.addEventListener('click', function() {
                const crop = this.getAttribute('data-crop');
                
                // Hide all crop details
                document.querySelectorAll('.crop-detail-content').forEach(detail => {
                    detail.style.display = 'none';
                });
                
                // Show selected crop details
                document.getElementById(`${crop}-details`).style.display = 'block';
                
                // Show the crop details section
                document.getElementById('cropDetails').classList.add('active');
                
                // Scroll to the details section
                document.getElementById('cropDetails').scrollIntoView({ behavior: 'smooth' });
            });
        });

        // Disease Detection Functionality
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const resultArea = document.getElementById('resultArea');
        const resultImage = document.getElementById('resultImage');

        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
            uploadArea.style.backgroundColor = 'rgba(46, 125, 50, 0.05)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.backgroundColor = 'transparent';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            uploadArea.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileSelect(e.target.files[0]);
            }
        });

        function handleFileSelect(file) {
            if (file.type.match('image.*')) {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    uploadArea.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">`;
                    analyzeBtn.style.display = 'inline-block';
                    
                    // Store the image for analysis
                    resultImage.src = e.target.result;
                };
                
                reader.readAsDataURL(file);
            } else {
                alert('Please select an image file.');
            }
        }

        analyzeBtn.addEventListener('click', () => {
            // In a real application, this would send the image to a backend for analysis
            // For this demo, we'll simulate the analysis result
            
            // Show loading state
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            analyzeBtn.disabled = true;
            
            // Simulate API call delay
            setTimeout(() => {
                // Show results
                resultArea.classList.add('active');
                analyzeBtn.style.display = 'none';
                
                // Reset button
                analyzeBtn.innerHTML = 'Analyze Image';
                analyzeBtn.disabled = false;
                
                // Scroll to results
                resultArea.scrollIntoView({ behavior: 'smooth' });
            }, 2000);
        });

        // Weather Functionality
        const weatherApiKey = '8934982b845f4a78993154154251410';
        const getWeatherBtn = document.getElementById('getWeather');
        const locationInput = document.getElementById('locationInput');
        const weatherDisplay = document.getElementById('weatherDisplay');

        getWeatherBtn.addEventListener('click', getWeather);

        async function getWeather() {
            const location = locationInput.value.trim();
            if (!location) {
                alert('Please enter a location');
                return;
            }

            try {
                getWeatherBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                getWeatherBtn.disabled = true;

                // Get current weather
                const currentWeatherResponse = await fetch(
                    `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${location}&aqi=no`
                );
                
                if (!currentWeatherResponse.ok) {
                    throw new Error('Weather data not found for this location');
                }
                
                const currentWeatherData = await currentWeatherResponse.json();

                // Get forecast
                const forecastResponse = await fetch(
                    `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${location}&days=5&aqi=no&alerts=no`
                );
                
                const forecastData = await forecastResponse.json();

                // Display weather data
                displayWeather(currentWeatherData, forecastData);
                
            } catch (error) {
                alert('Error fetching weather data: ' + error.message);
                console.error('Weather API error:', error);
            } finally {
                getWeatherBtn.innerHTML = 'Get Weather';
                getWeatherBtn.disabled = false;
            }
        }

        function displayWeather(currentData, forecastData) {
            // Update current weather
            document.getElementById('currentTemp').textContent = `${currentData.current.temp_c}°C`;
            document.getElementById('weatherDescription').textContent = currentData.current.condition.text;
            document.getElementById('locationName').textContent = `${currentData.location.name}, ${currentData.location.country}`;
            
            // Update weather icon
            const weatherIcon = document.getElementById('weatherIcon');
            const condition = currentData.current.condition.text.toLowerCase();
            if (condition.includes('sunny') || condition.includes('clear')) {
                weatherIcon.className = 'fas fa-sun';
            } else if (condition.includes('cloud')) {
                weatherIcon.className = 'fas fa-cloud';
            } else if (condition.includes('rain')) {
                weatherIcon.className = 'fas fa-cloud-rain';
            } else if (condition.includes('snow')) {
                weatherIcon.className = 'fas fa-snowflake';
            } else {
                weatherIcon.className = 'fas fa-cloud-sun';
            }

            // Update forecast
            const forecastContainer = document.getElementById('weatherForecast');
            forecastContainer.innerHTML = '';
            
            forecastData.forecast.forecastday.forEach(day => {
                const forecastDay = document.createElement('div');
                forecastDay.className = 'forecast-day';
                
                const date = new Date(day.date);
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const dayName = dayNames[date.getDay()];
                
                forecastDay.innerHTML = `
                    <h4>${dayName}</h4>
                    <div class="forecast-temp">${day.day.avgtemp_c}°C</div>
                    <p>${day.day.condition.text}</p>
                    <p>Humidity: ${day.day.avghumidity}%</p>
                `;
                
                forecastContainer.appendChild(forecastDay);
            });

            // Show weather display
            weatherDisplay.classList.add('active');
        }

        // Smooth scrolling for navigation links
        document.querySelectorAll('nav a, .btn[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });

        // Initialize with default weather for Indore
        window.addEventListener('load', () => {
            locationInput.value = 'Indore, India';
            getWeather();
        });
    