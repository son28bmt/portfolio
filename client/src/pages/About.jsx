import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Briefcase, GraduationCap, Code, User, ChevronRight, Rocket } from 'lucide-react';

const About = () => {
  const timeline = [
  {
    year: '2021',
    title: 'Bắt đầu học lập trình',
    description: 'Những năm đầu đại học, tôi bắt đầu làm quen với lập trình, tìm hiểu các khái niệm cơ bản và viết những dòng code đầu tiên.',
    icon: <Code className="w-5 h-5" />,
  },
  {
    year: '2022',
    title: 'Tiếp cận Web (HTML, CSS, JavaScript)',
    description: 'Bắt đầu học phát triển web với HTML, CSS và JavaScript, xây dựng các giao diện cơ bản và hiểu cách website hoạt động.',
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    year: '2023',
    title: 'Tìm hiểu Framework',
    description: 'Tiếp cận các framework như React, học cách tổ chức code, tái sử dụng component và nâng cao tư duy lập trình.',
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    year: '2024',
    title: 'Thực hiện các dự án cá nhân',
    description: 'Xây dựng nhiều dự án thực tế như web, app và tool, từ đó nâng cao kỹ năng và tích lũy kinh nghiệm thực hành.',
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    year: '2025',
    title: 'Intern React Developer',
    description: 'Làm việc trong môi trường thực tế, học cách làm việc nhóm, sử dụng Git, API và quy trình phát triển phần mềm chuyên nghiệp.',
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    year: 'Hiện tại',
    title: 'Định hướng tương lai',
    description: 'Tiếp tục phát triển theo hướng Fullstack Developer, xây dựng các sản phẩm thực tế và tích hợp AI vào ứng dụng.',
    icon: <Rocket className="w-5 h-5" />,
  }
]

  const skills = [
    { category: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion'] },
    { category: 'Backend', items: ['NodeJS', 'Express', 'C#', 'Python', 'SQL'] },
    { category: 'Soft Skills', items: ['Teamwork', 'Problem Solving', 'Adaptability'] },
  ];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 md:px-0">
      {/* Profile Section */}
      <section className="mb-20">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 md:w-64 md:h-64 rounded-3xl bg-gradient-to-br from-primary to-secondary p-1 shrink-0"
          >
            <div className="w-full h-full bg-background rounded-[22px] flex items-center justify-center overflow-hidden">
              <img 
                src="https://pub-58c1a2fe07b6492fbadd2e958ca80bb9.r2.dev/0.jpg" 
                alt="Nguyễn Quang Sơn" 
                className="w-full h-full object-cover" 
              />
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6 flex items-center gap-3">
              Kể câu chuyện của tôi
              <BookOpen className="text-primary w-8 h-8" />
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-6">
              Tôi là một nhà phát triển phần mềm đam mê, luôn tìm tòi và học hỏi những công nghệ mới. 
              Với phương châm "Biến ý tưởng thành sản phẩm thực tế", tôi không ngừng cải thiện kỹ năng 
              để mang lại những giải pháp tốt nhất.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary">☕ Hay thức đêm debug</span>
              <span className="px-4 py-2 bg-secondary/10 border border-secondary/20 rounded-full text-sm text-secondary">🎮 Đam mê công nghệ</span>
              <span className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-sm text-accent">🎵 ShanVietSub</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="mb-20">
        <h3 className="text-2xl font-bold mb-10 text-center">Hành trình phát triển</h3>
        <div className="relative border-l border-white/10 ml-4 md:ml-0 md:left-1/2">
          {timeline.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={`mb-12 relative ${index % 2 === 0 ? 'md:mr-auto md:pr-12 md:text-right' : 'md:ml-auto md:pl-12'} md:w-1/2`}
            >
              {/* Timeline Dot */}
              <div 
                className={`absolute top-0 w-8 h-8 bg-surface border border-white/20 rounded-full flex items-center justify-center text-primary glow z-10 
                  left-[-41px] md:left-auto ${index % 2 === 0 ? 'md:right-[-17px]' : 'md:left-[-17px]'}`}
              >
                {item.icon}
              </div>
              
              <div className="glass p-5 md:p-6 rounded-2xl hover:border-primary/50 transition-colors">
                <span className="text-primary font-bold text-xs md:text-sm mb-2 block">{item.year}</span>
                <h4 className="text-lg md:text-xl font-bold mb-3">{item.title}</h4>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Skills Section */}
      <section>
        <h3 className="text-2xl font-bold mb-10 text-center">Bộ kỹ năng</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {skills.map((skillGroup, idx) => (
            <motion.div
              key={skillGroup.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-8 rounded-3xl"
            >
              <h4 className="text-lg font-bold mb-6 text-gradient">{skillGroup.category}</h4>
              <ul className="space-y-4">
                {skillGroup.items.map((skill) => (
                  <li key={skill} className="flex items-center gap-3 text-white/70">
                    <ChevronRight className="w-4 h-4 text-primary" />
                    {skill}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};


export default About;
