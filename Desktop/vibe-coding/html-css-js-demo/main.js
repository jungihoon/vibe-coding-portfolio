const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".nav");
const dots = document.querySelectorAll(".dot");

if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
}

if (dots.length > 0) {
    let activeIndex = 0;

    setInterval(() => {
        dots[activeIndex].classList.remove("active");
        activeIndex = (activeIndex + 1) % dots.length;
        dots[activeIndex].classList.add("active");
    }, 1800);
}