export default function Button({ children, type = 'button', ...props }) {
  return <button className="button" type={type} {...props}>{children}</button>;
}
