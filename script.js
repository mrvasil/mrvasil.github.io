// Custom cursor
document.addEventListener('DOMContentLoaded', () => {
    // Удаляем код курсора
    // ... existing code ...
    
    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const moonIcon = themeToggle.querySelector('.fa-moon');
    const sunIcon = themeToggle.querySelector('.fa-sun');
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        // Обновляем цвет header при переключении темы с учетом прокрутки
        const header = document.querySelector('header');
        const isScrolled = header.classList.contains('scrolled');
        header.style.backgroundColor = isLight 
            ? `rgba(255, 255, 255, ${isScrolled ? '0.75' : '0.6'})` 
            : `rgba(18, 18, 18, ${isScrolled ? '0.75' : '0.6'})`;
    });
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else if (!savedTheme) {
        // If no theme is saved, explicitly set dark theme
        localStorage.setItem('theme', 'dark');
    }
    
    // Typing animation
    const words = ['websites.', 'applications.', 'solutions.', 'experiences.', 'innovations.', 'designs.', 'technologies.', 'platforms.', 'interfaces.', 'strategies.'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingDelay = 200;
    
    const dynamicText = document.querySelector('.dynamic-text');
    
    function typeEffect() {
        const currentWord = words[wordIndex];
        
        if (isDeleting) {
            dynamicText.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
            typingDelay = 100;
        } else {
            dynamicText.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
            typingDelay = 200;
        }
        
        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            typingDelay = 1000; // Pause at end of word
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typingDelay = 500; // Pause before typing next word
        }
        
        setTimeout(typeEffect, typingDelay);
    }
    
    // Start typing animation
    setTimeout(typeEffect, 1000);
    
    // Terminal animation
    const terminalLines = document.querySelectorAll('.terminal-body .line');
    let lineIndex = 0;
    
    function showNextLine() {
        if (lineIndex < terminalLines.length) {
            // Remove cursor from previous line if exists
            const prevCursor = document.querySelector('.terminal-cursor');
            if (prevCursor) prevCursor.remove();

            const line = terminalLines[lineIndex];
            line.style.display = 'block';
            
            // Add classes based on whether it's a command or output
            if (line.textContent.startsWith('$')) {
                line.classList.add('command');
                line.textContent = line.textContent.substring(2); // Remove the '$ ' prefix
            } else {
                line.classList.add('output');
            }

            // Add cursor to current line
            const cursor = document.createElement('span');
            cursor.className = 'terminal-cursor';
            line.appendChild(cursor);
            
            lineIndex++;
            setTimeout(showNextLine, 500);
        }
    }
    
    // Hide all lines initially
    terminalLines.forEach(line => {
        line.style.display = 'none';
    });
    
    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('terminal')) {
                    showNextLine();
                }
                entry.target.classList.add('animate');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    // Observe elements for animation
    document.querySelectorAll('.skill-card, .project-card, .terminal').forEach(el => {
        observer.observe(el);
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Update copyright year
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Улучшенная обработка прокрутки для header
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        const isLight = document.body.classList.contains('light-theme');
        
        if (window.scrollY > 50) { // Уменьшили порог срабатывания
            header.classList.add('scrolled');
            header.style.backgroundColor = isLight 
                ? 'rgba(255, 255, 255, 0.75)' 
                : 'rgba(18, 18, 18, 0.75)';
        } else {
            header.classList.remove('scrolled');
            header.style.backgroundColor = isLight
                ? 'rgba(255, 255, 255, 0.6)'
                : 'rgba(18, 18, 18, 0.6)';
        }
    });
    
    // Add animation classes to elements when they come into view
    const animatedElements = document.querySelectorAll('.hero h1, .bio, .cta-buttons, .skill-card, .project-card');
    
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    animatedElements.forEach(el => {
        fadeObserver.observe(el);
    });
});

// Add these CSS classes to your styles.css file for the animations
document.head.insertAdjacentHTML('beforeend', `
<style>
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .fade-in {
        animation: fadeIn 0.8s ease forwards;
    }
    
    header.scrolled {
        background-color: var(--bg-color);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .terminal-body .line {
        opacity: 0;
        transform: translateY(10px);
        animation: fadeIn 0.5s ease forwards;
    }
</style>
`);
