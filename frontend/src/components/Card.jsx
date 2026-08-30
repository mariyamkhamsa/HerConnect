import React from 'react'

export default function Card({ children, hover = false, className = '', style = {} }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} style={style}>
      {children}
    </div>
  )
}
