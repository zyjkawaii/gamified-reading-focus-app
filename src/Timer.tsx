import React, { useState, useEffect, useRef } from 'react';

export default function Timer() {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  
  const [showPrompt, setShowPrompt] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState(10);
  
  const timerRef = useRef(null);
  const promptTimerRef = useRef(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      clearInterval(timerRef.current);
      setIsRunning(false);
      setShowPrompt(true);
      setAutoStartCountdown(10);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (showPrompt && autoStartCountdown > 0) {
      promptTimerRef.current = setInterval(() => {
        setAutoStartCountdown((prev) => prev - 1);
      }, 1000);
    } else if (showPrompt && autoStartCountdown === 0) {
      clearInterval(promptTimerRef.current);
      handleStartNew();
    }
    return () => clearInterval(promptTimerRef.current);
  }, [showPrompt, autoStartCountdown]);

  const toggleTimer = () => setIsRunning(!isRunning);

  const handleTimeChange = (e) => {
    const val = parseInt(e.target.value) || 25;
    setFocusMinutes(val);
    setTimeLeft(val * 60);
    setIsRunning(false);
  };

  const handleStartNew = () => {
    setShowPrompt(false);
    setTimeLeft(focusMinutes * 60);
    setIsRunning(true);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ 
      fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
      backgroundColor: '#ffffff',
      padding: '40px 30px',
      borderRadius: '20px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
      textAlign: 'center',
      width: '320px',
      margin: '0 auto'
    }}>
      <h2 style={{ fontWeight: '600', color: '#4B5563', marginTop: 0, marginBottom: '20px', fontSize: '22px' }}>
        🍅 专注罐头
      </h2>
      
      <div>
        <label style={{ fontSize: '14px', color: '#6B7280' }}>专注时间（分钟）：</label>
        <input 
          type="number" 
          value={focusMinutes} 
          onChange={handleTimeChange}
          min="1"
          style={{ 
            padding: '8px 12px', fontSize: '16px', width: '60px', 
            border: '2px solid #E5E7EB', borderRadius: '8px', marginLeft: '10px',
            outline: 'none', fontWeight: 'bold', color: '#374151'
          }}
          disabled={isRunning}
        />
      </div>

      <h1 style={{ 
        fontSize: '72px', fontWeight: 'bold', color: '#34D399', 
        margin: '20px 0', fontVariantNumeric: 'tabular-nums' 
      }}>
        {formatTime(timeLeft)}
      </h1>

      <button 
        onClick={toggleTimer} 
        style={{ 
          padding: '12px 24px', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
          border: 'none', borderRadius: '10px', transition: 'all 0.2s ease', margin: '5px',
          backgroundColor: isRunning ? '#F59E0B' : '#0EA5E9', 
          color: 'white',
          boxShadow: isRunning ? '0 4px 12px rgba(245, 158, 11, 0.2)' : '0 4px 12px rgba(14, 165, 233, 0.2)'
        }}
      >
        {isRunning ? '暂停' : '开始专注'}
      </button>
      
      <button 
        onClick={() => { setIsRunning(false); setTimeLeft(focusMinutes * 60); }} 
        style={{ 
          padding: '12px 24px', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
          border: 'none', borderRadius: '10px', transition: 'all 0.2s ease', margin: '5px',
          backgroundColor: '#F3F4F6', color: '#4B5563' 
        }}
      >
        重置
      </button>

      {showPrompt && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', backgroundColor: '#ffffff',
          color: '#374151', padding: '24px', borderRadius: '16px', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 1000, width: '260px',
          borderLeft: '6px solid #34D399', textAlign: 'left',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827' }}>🎉 专注完成！</h3>
          <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: 1.5 }}>
            是否继续新的专注？<br/>
            <strong style={{ color: '#10B981' }}>{autoStartCountdown} 秒</strong>后自动开始...
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={handleStartNew}
              style={{ 
                width: '100%', padding: '10px', backgroundColor: '#34D399', border: 'none', 
                borderRadius: '8px', cursor: 'pointer', color: 'white', fontWeight: 'bold'
              }}
            >
              立即开始
            </button>
            <button 
              onClick={() => setShowPrompt(false)}
              style={{ 
                width: '100%', padding: '10px', backgroundColor: 'transparent', border: 'none', 
                color: '#9CA3AF', cursor: 'pointer' 
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
