import React, { useState } from 'react'; 
import { useNavigate } from 'react-router-dom';  // Replace Link with useNavigate
import './Home.css';  

export default function Home() {
     const [level, setLevel] = useState(1);
     const navigate = useNavigate();  // Use useNavigate hook

     const handleLevelChange = (e) => {
         const value = e.target.value;
         const levels = { easy: 1, medium: 2, hard: 3 };
         setLevel(levels[value]);
         console.log("Selected level:", levels[value]);
     };

     const handleStartClick = () => {
         navigate('/start', { state: { level } });  // Pass level in state
     };

     return (
         <div className='home-container'>
             <div className='home-header'></div>
             <h1 className="description">A Yoga AI Trainer</h1>
             <div className="home-main"
                 style={{
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center',
                     height: '100vh'
                 }}
             >
                 {/* Option Section */}
                 <div className="option-section">
                     <label htmlFor="level-select">Choose difficulty level:</label>
                     <select id="level-select" onChange={handleLevelChange}>
                         <option value="easy">Easy</option>
                         <option value="medium">Medium</option>
                         <option value="hard">Hard</option>
                     </select>
                 </div>
                 
                 {/* Button Section */}
                 <div className="btn-section" style={{ marginTop: '20px' }}>
                     <button 
                         className="btn start-btn"
                         onClick={handleStartClick}
                     >
                         Let's Start
                     </button>
                 </div>
             </div>
         </div>
     ); 
}