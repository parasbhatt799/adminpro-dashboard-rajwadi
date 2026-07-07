import React, { useState, useEffect } from 'react';
import './WeatherBackground.css';

// WeatherBackground is now a standalone background container

type WeatherState = 'sunny' | 'cloudy' | 'rainy' | 'thunderstorm' | 'night' | 'cloudy_night';

export default function WeatherBackground() {
  const [weatherState, setWeatherState] = useState<WeatherState>('sunny');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code`
        );
        if (!response.ok) throw new Error('Weather API request failed');
        const data = await response.json();
        
        const code = data?.current?.weather_code ?? 0;
        const hour = new Date().getHours();
        const isNightTime = hour >= 19 || hour < 6; // Night time past 7 PM and before 6 AM
        
        let state: WeatherState = 'sunny';

        if (isNightTime) {
          if (code >= 1 && code <= 3) {
            state = 'cloudy_night';
          } else if ((code >= 51 && code <= 82) || (code >= 45 && code <= 48)) {
            state = 'rainy'; // fog or rain
          } else if (code >= 95 && code <= 99) {
            state = 'thunderstorm';
          } else {
            state = 'night';
          }
        } else {
          if (code === 0) {
            state = 'sunny';
          } else if (code >= 1 && code <= 3) {
            state = 'cloudy';
          } else if ((code >= 51 && code <= 82) || (code >= 45 && code <= 48)) {
            state = 'rainy';
          } else if (code >= 95 && code <= 99) {
            state = 'thunderstorm';
          } else {
            state = 'sunny';
          }
        }

        setWeatherState(state);
      } catch (err) {
        console.warn('Weather detection failed, applying daytime/nighttime defaults:', err);
        // Fallback to time of day default
        const hour = new Date().getHours();
        const isNightTime = hour >= 19 || hour < 6;
        setWeatherState(isNightTime ? 'night' : 'sunny');
      } finally {
        setLoading(false);
      }
    };

    // Get user geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Geolocation rejected / failed: Fallback to Surat, Gujarat coordinates
          fetchWeather(21.1702, 72.8311);
        }
      );
    } else {
      // Geolocation not supported: Fallback to Surat coordinates
      fetchWeather(21.1702, 72.8311);
    }
  }, []);

  useEffect(() => {
    const handleWeatherOverride = (e: Event) => {
      const customState = (e as CustomEvent).detail as WeatherState;
      if (customState) {
        setWeatherState(customState);
      }
    };
    window.addEventListener('change-weather', handleWeatherOverride);
    return () => window.removeEventListener('change-weather', handleWeatherOverride);
  }, []);

  // Generate 35 rain drops
  const renderRainDrops = () => {
    return Array.from({ length: 35 }).map((_, index) => {
      const left = `${Math.random() * 100}%`;
      const delay = `${Math.random() * 2}s`;
      const duration = `${0.8 + Math.random() * 0.7}s`;
      return (
        <div
          key={`rain-${index}`}
          className="rain-drop"
          style={{ left, animationDelay: delay, animationDuration: duration }}
        />
      );
    });
  };

  // Generate 25 stars
  const renderStars = () => {
    return Array.from({ length: 25 }).map((_, index) => {
      const left = `${Math.random() * 100}%`;
      const top = `${Math.random() * 45}%`; // Limit stars to upper half of dashboard
      const delay = `${Math.random() * 3}s`;
      const size = `${1 + Math.random() * 2}px`;
      return (
        <div
          key={`star-${index}`}
          className="star"
          style={{ left, top, animationDelay: delay, width: size, height: size }}
        />
      );
    });
  };

  return (
    <div className={`weather-bg-container ${weatherState}`}>
      {/* 1. Sunny Effect */}
      {weatherState === 'sunny' && <div className="weather-sunrays" />}

      {/* 2. Cloudy Effects (Day or Night) */}
      {(weatherState === 'cloudy' || weatherState === 'cloudy_night') && (
        <div className="weather-clouds-wrapper">
          <div className="weather-cloud cloud-1" />
          <div className="weather-cloud cloud-2" />
          <div className="weather-cloud cloud-3" />
          <div className="weather-cloud cloud-4" />
          <div className="weather-cloud cloud-5" />
        </div>
      )}

      {/* 3. Rainy Effects */}
      {weatherState === 'rainy' && (
        <>
          <div className="weather-clouds-wrapper rainy-clouds">
            <div className="weather-cloud cloud-1" />
            <div className="weather-cloud cloud-2" />
            <div className="weather-cloud cloud-3" />
            <div className="weather-cloud cloud-4" />
            <div className="weather-cloud cloud-5" />
          </div>
          <div className="weather-rain-wrapper">
            {renderRainDrops()}
          </div>
        </>
      )}

      {/* 4. Thunderstorm Effects */}
      {weatherState === 'thunderstorm' && (
        <>
          <div className="weather-thunder-flash" />
          <div className="weather-clouds-wrapper rainy-clouds">
            <div className="weather-cloud cloud-1" />
            <div className="weather-cloud cloud-2" />
            <div className="weather-cloud cloud-3" />
            <div className="weather-cloud cloud-4" />
            <div className="weather-cloud cloud-5" />
          </div>
          <div className="weather-rain-wrapper">
            {renderRainDrops()}
          </div>
        </>
      )}

      {/* 5. Night Effects (Clear or Cloudy Night) */}
      {(weatherState === 'night' || weatherState === 'cloudy_night') && (
        <div className="weather-stars-wrapper">
          {renderStars()}
        </div>
      )}

    </div>
  );
}
