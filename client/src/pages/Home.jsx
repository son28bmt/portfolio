import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Terminal, Code2, Rocket, ArrowRight } from 'lucide-react';

const Home = () => {
  const words = React.useMemo(() => ["I build tools.", "I build websites.", "I solve problems."], []);
  const [currentWordIndex, setCurrentWordIndex] = React.useState(0);
  const [currentText, setCurrentText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const currentWord = words[currentWordIndex];
      
      if (!isDeleting) {
        setCurrentText(currentWord.substring(0, currentText.length + 1));
        if (currentText === currentWord) {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        setCurrentText(currentWord.substring(0, currentText.length - 1));
        if (currentText === "") {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? 50 : 150);
    
    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentWordIndex, words]);

  const techStack = [
    { name: 'C#', icon: <Terminal className="w-6 h-6" /> },
    { name: 'Python', icon: <Terminal className="w-6 h-6" /> },
    { name: 'React', icon: <Code2 className="w-6 h-6" /> },
    { name: 'NodeJS', icon: <Rocket className="w-6 h-6" /> },
    { name: 'Tailwind', icon: <Code2 className="w-6 h-6" /> },
    { name: 'Express', icon: <Rocket className="w-6 h-6" /> },
  ];

  return (
    <div className="relative overflow-hidden pt-20 pb-20 md:pt-32 md:pb-40">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/30 rounded-full blur-[128px]" />
      </div>

      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-block px-4 py-1.5 mb-8 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/80"
        >
          👋 Sẵn sàng cho những thử thách mới
        </motion.div>

        <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 leading-tight px-4">
          Nguyễn Quang Sơn <br />
          <span className="text-gradient">Fullstack Developer</span>
        </h1>

        <div className="h-12 md:h-16 mb-8 px-4">
          <p className="text-xl sm:text-2xl md:text-4xl font-display text-white/70">
            {currentText}
            <span className="animate-pulse bg-primary ml-1 inline-block w-1 h-6 sm:h-8 md:h-10 align-middle" />
          </p>
        </div>

        <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mb-12 px-6">
          "Biến ý tưởng thành sản phẩm thực tế". Tôi tập trung vào việc tạo ra các giải pháp phần mềm hiệu quả, mượt mà và đầy cảm hứng.
        </p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row gap-4 mb-20"
        >
          <Link 
            to="/du-an" 
            className="px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold flex items-center gap-2 transition-all glow group"
          >
            Xem Dự Án
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            to="/lien-he" 
            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-semibold transition-all"
          >
            Liên Hệ Tôi
          </Link>
        </motion.div>

        {/* Tech Stack Marquee-style */}
        <div className="w-full max-w-4xl">
          <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-8">Công nghệ yêu thích</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-8 px-4">
            {techStack.map((tech, index) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="glass p-4 rounded-2xl flex flex-col items-center gap-3 hover:border-primary/50 transition-colors group"
              >
                <div className="text-white/40 group-hover:text-primary transition-colors">
                  {tech.icon}
                </div>
                <span className="text-xs font-bold text-white/60">{tech.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
