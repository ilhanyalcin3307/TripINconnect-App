import React from 'react';

function Toast({ show, message }) {
  return (
    <div className={`toast ${show ? 'show' : ''}`}>
      {message}
    </div>
  );
}

export default Toast;
