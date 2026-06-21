import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  delay?: number;
}

export default function Section({ title, children, action, delay = 0 }: Props) {
  return (
    <section
      className="mb-10 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4 px-6">
        <h2 className="text-xl font-bold">{title}</h2>
        {action}
      </div>
      <div className="px-6">{children}</div>
    </section>
  );
}
