import React from 'react'

export default function Button({
  children, variant = 'primary', size, block, onClick, type = 'button', disabled, ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    size === 'lg' ? 'btn-lg' : '',
    block ? 'btn-block' : '',
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
