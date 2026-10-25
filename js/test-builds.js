// ==========================================================================
// VahanaIQ Interactive Streamlining Test Builds Controller (js/test-builds.js)
// Dynamically transforms the live DOM across:
//   - Layout Options: option1 (Progressive Disclosure), option2 (Tabbed Views),
//                     option3 (Split-Pane Dashboard), hybrid (Summary + Tabs),
//                     baseline (Original v2.11.6)
//   - Budget Modes:   gauge (Compact DTI Speedometer), inline (Slim Inline Bar)
//   - All 3 Pages:    index.html, catalogue.html, studio.html
// ==========================================================================

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // Safety guard: Test build transformations and switcher bar must never mount
  // unless explicitly enabled via ?test_build=1 query param or test flag.
  if (!window.location.search.includes("test_build=1") && !window.__VAHANAIQ_ENABLE_TEST_BUILDS__) return;

  const LAYOUT_KEY = "vahanaiq_tb_layout";
  const BUDGET_KEY = "vahanaiq_tb_budget";
  const COMPARISON_KEY = "vahanaiq_comparison_v3";
  const INPUTS_KEY = "vahanaiq_inputs_v1";

  const DEMO_CARS_1 = [
    {
      id: "legacy-byd-sealion-5-premium",
      name: "BYD Sealion 5 Dynamic",
      trim: "Dynamic",
      price: 19477000,
      cond: "New",
      w: "Official",
      pt: "1.5L DM-i Plug-in Hybrid · 12.9 kWh Blade Battery",
      power: "197 HP combined",
      drivetrain: "FWD",
      km: "75 km pure EV · 1,000+ km combined",
      priceBasis: "published",
      legacy: false,
      custom: false
    }
  ];

  const DEMO_CARS_3 = [
    ...DEMO_CARS_1,
    {
      id: "legacy-raize-z-hybrid",
      name: "Toyota Raize Z Hybrid",
      trim: "Z e-SMART Hybrid",
      price: 13850000,
      cond: "Recond",
      w: "Grey",
      pt: "1.2L e-SMART Series Hybrid",
      power: "106 HP",
      drivetrain: "FWD",
      km: "28.0 km/L WLTC",
      priceBasis: "published",
      legacy: true,
      custom: false
    },
    {
      id: "legacy-vezel-ehev-z",
      name: "Honda Vezel e:HEV Z",
      trim: "e:HEV Z Play",
      price: 17900000,
      cond: "Recond",
      w: "Grey",
      pt: "1.5L e:HEV Dual-Motor Hybrid",
      power: "131 HP",
      drivetrain: "FWD",
      km: "25.0 km/L WLTC",
      priceBasis: "published",
      legacy: true,
      custom: false
    }
  ];

  const path = window.location.pathname.toLowerCase();
  const pageType = path.includes("catalogue")
    ? "catalogue"
    : path.includes("studio")
    ? "studio"
    : "calculator";

  const params = new URLSearchParams(window.location.search);
  const preset = window.__VAHANAIQ_TB_PRESET__ || {};

  let currentLayout =
    params.get("layout") ||
    preset.layout ||
    localStorage.getItem(LAYOUT_KEY) ||
    "option1";

  let currentBudget =
    params.get("budget") ||
    preset.budget ||
    localStorage.getItem(BUDGET_KEY) ||
    "gauge";

  let activeTab = params.get("tab") || "compare";

  if (!["option1", "option2", "option3", "hybrid", "baseline"].includes(currentLayout)) {
    currentLayout = "option1";
  }
  if (!["gauge", "inline"].includes(currentBudget)) {
    currentBudget = "gauge";
  }

  try {
    localStorage.setItem(LAYOUT_KEY, currentLayout);
    localStorage.setItem(BUDGET_KEY, currentBudget);
  } catch (e) {}

  function ensureDemoSeeded(mode) {
    try {
      const existingCarsRaw = localStorage.getItem(COMPARISON_KEY);
      let hasCars = false;
      if (existingCarsRaw) {
        const parsed = JSON.parse(existingCarsRaw);
        hasCars = Array.isArray(parsed?.cars) && parsed.cars.length > 0;
      }
      if (mode === "1car" || (mode === "auto" && !hasCars)) {
        localStorage.setItem(
          COMPARISON_KEY,
          JSON.stringify({ version: 3, cars: DEMO_CARS_1 })
        );
        const existingInputs = JSON.parse(localStorage.getItem(INPUTS_KEY) || "{}");
        if (!existingInputs.income) {
          existingInputs.income = "250000";
          localStorage.setItem(INPUTS_KEY, JSON.stringify(existingInputs));
        }
      } else if (mode === "3cars") {
        localStorage.setItem(
          COMPARISON_KEY,
          JSON.stringify({ version: 3, cars: DEMO_CARS_3 })
        );
        const existingInputs = JSON.parse(localStorage.getItem(INPUTS_KEY) || "{}");
        if (!existingInputs.income) {
          existingInputs.income = "250000";
          localStorage.setItem(INPUTS_KEY, JSON.stringify(existingInputs));
        }
      }
    } catch (e) {}
  }

  if (pageType === "calculator") {
    const demoParam = params.get("demo") || preset.demo || "auto";
    if (demoParam === "1car" || demoParam === "3cars" || demoParam === "auto") {
      ensureDemoSeeded(demoParam);
    }
  }

  function applyBodyAttributes() {
    if (!document.body) return;
    document.body.classList.add("tb-active");
    document.body.setAttribute("data-test-page", pageType);
    document.body.setAttribute("data-test-layout", currentLayout);
    document.body.setAttribute("data-test-budget", currentBudget);
    document.body.setAttribute("data-test-tab", activeTab);
  }

  // Fix Hero H1 <br> so single-line headings always have a space ("Know Your Monthly Rental.")
  function syncHeroHeading() {
    const h1 = document.querySelector(".hero h1");
    if (!h1) return;
    if (!h1.dataset.origHtml) {
      h1.dataset.origHtml = h1.innerHTML;
    }
    if (currentLayout === "baseline") {
      h1.innerHTML = h1.dataset.origHtml;
    } else {
      h1.innerHTML = h1.dataset.origHtml.replace(/<br\s*\/?>/gi, " ");
    }
  }

  
  const STUDIO_FIXTURE_FILENAME = "audi-a3-studio-fixture.jpg";
  const STUDIO_FIXTURE_B64 = "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAADIKADAAQAAAABAAABpAAAAAD/wAARCAGkAyADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAy/9oADAMBAAIRAxEAPwD8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/0Pxbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/R/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9L8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/0/xbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/U/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoqxaWl1f3MdlYQSXNzMdqRRIZJHPoqqCSfoK9v0v9l/8AaK1m1W9074c63JA+CrNZvHkH0D7TUSqRj8TM6laEPjkl6s8Ior0Hxh8J/ih8Phv8ceE9U0KPOPMu7SSKPJ6fORt57c159VRknqioTjJXi7oKKKKZQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/1fxbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAr6I/Zu/Zx8XftG+MzoGiN9g0ew2yanqTqWjtomPCqP45XwdiZ9ScAGvngK7kJGpZ2OAB1JPQV/UD+zB8G9P8Agd8G9C8IxQqmqXES3mqSAfNLezqGkyfSMYjUdgv1rz8xxnsoabs8LP8ANXhaN4fE9v8AM1fg5+zz8KfgXpMen+BNGjjvAoE2ozqst9Oe5eYjIB/urtUdhXtxJJyTk0lFfIzm5O8ndn5ZVrSqSc5u7Ibq2tr62ksr2FLi3mBV4pVDxsDwQytkEH3FfmJ+1R/wT98M+KtNvvHXwNsk0bxDArTTaRF8tpegAlhAvSKY/wAKjCMeMKea/UGitcPiZ05c0GdOBx9XDz56Tt+T9T+QCeCe1nktbqNoZ4WZJI3BV0dThlYHkEHgg9Kir9JP+CkvwYs/A/xM0/4m6DbiDTvGiyfalQYVdRgx5jf9tkIc+rBjX5t19nh6yqQU11P1zA4uNejGrHqFFFFbHWFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/1vxbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD0X4P2Nvqfxa8E6ddrvgudb05HX+8puUyPxHFf1gv99sepr+Q/QNZufDmvaZ4is/8Aj40q6gu4/wDft5BIv6rX9Z3hPxPpnjXwtpHjDRpBLY63aQ3kLA5+SdA4HHcZwfcV89nkXeLPg+M6bvTl01OgooorwD4cKKKKAPzp/wCCnWn21x+z5pmoSgedZa/aCM9/3sMytj8BX4I1+zX/AAVN+INrDoHg74W20ga6uriTVrlQeViiUww59NzM5H+7X4y19dlMWqCufqXC1Nxwcb9Wwooor0j6IKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//X/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACv1h/4J/ftZ6V4Vgj+BfxLvltNOllZtFvp2xFDJKctaSMeFVmO6MngMSp6ivyeoIB4NYYnDxqw5JHFmGAhiaTpVP+GP7BKK/nO+CX7dvxr+Ddnb6BcTx+LPD9uAsdpqRYywoP4YbhfnUAdFbco7AV9waT/wVS+HklsG13wJq1tcY5W1uLedM+zOYj/47XzNXKa0Xorn51iuF8XTlaK5l3R+qNeY/Fz4u+Cfgl4Lu/G/jq8FvaQArDCpBnu5sfLDCh+87fko5JAFfl546/4Kn6jPavbfDTwQlnMwIFzqtx520nuIIQoJHvIR7V+aHxM+LHxB+MHiFvE/xE1mbV73BWMOQsMCH+CGJcJGvso575NbYbJ5yd6miOvL+FK05J1/dj+Jb+MnxW8R/Gv4i6v8RfEx23OpSYigUkpbW6cRQJnsi9+5yeprzCiivpYxSVkfolOnGEVGKskFFFFUWFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf/Q/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACii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uFFFFABRRSgEnA70AfnP/wAFE/iH/Y/gTRPhvZy7bjxBcfa7lR1+y2n3QfZpSMeuw+lfj1X0x+118RP+FjfHXX7y3l8zT9GYaXaY6bLUlZGH+9KXP0xXzPWMnqf2NwBk31HKqNJr3pLmfrLX8FZfIKKKKk+yCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9P8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAr9ZP2LvGn/CQ/C6Xwzcybrrw3ctCATz9nnzJH+AO9R9K/Juvq39jrxp/wjHxci0W4fba+JIHsyCePPX95CfqSCo/3q3w87TR+beLORfXsjrKKvKn76/7d3/8AJbn670UUV6p/DAUUUUAFFFFAHyb+2V4S/wCEh+EL61Cm648O3Ud1nHPlP+6k/wDQgT9K/I2v6B/FGg23inw1qvhq7GYdUtZrZs8481CufwJzX4B6hYXOlahdaVersuLKV4JFPZ42KsPzFedjI6pn9Z+AOc+1wFbBSetOV16S/wCCn95UooorkP30KKKKACiiigAooooAKsWlpdahdwWFjE09zdSLFFGoyzyOQqqB3JJAFV6+5/2DvhIPHPxRfxzqsPmaT4PVZl3D5XvpMiBffYAZD6EL68tI8nPc3p4DCVMXU2ir+r6L5vQ/Vj4E/DC1+EHwt0PwREo+1W8Xm3rj/lpeTfNM2e+G+Uf7KivXaKK3P4mxmLqV6s69V3lJtv1YUUUUHMFFFFABXlHxx8fx/C/4T+JvGpcLcWNo622e91N+7hH/AH2wP0Fer1+X3/BRz4h+TYeGvhZZyfNcs2qXig/wJmKBT9WLt+ApSdkfTcHZN9fzKjhmtG7v0Wr+9afM/KZ5JJXaWZi8jkszHksx5JPuTTaKKwP7SCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/U/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACii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FFFABRRRQB//1/xbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArS0bVrzQdXsdc09tl1p88dxEf9uJgw/UVm0UEzgpRcZK6Z/QT4Z1608U+HdM8S2Bzb6pbRXKewlUNj8M4rbr4/wD2LvGn/CQfC6bwzcSbrnw3ctEoJ5+zz5kj/ANvUfTFfYFezTleKZ/nhxTkry7Ma+Cf2JNL03T+aswoooqzwAooooAztX0u11zSb3RL5d1vqEElvIP9iVSp/Q1+AWv6NdeHNd1Hw/ejE+mXEts/+9ExUn8cZr+g6vyA/bB8Jf8ACNfGS71KFNtv4hgjvV448z/Vy/8Ajy7j9a48ZHRM/oHwAzn2eNr4GT0nHmXrH/gN/cfLVFFFeef1eFFFFAH6k/8ABNnVdBWbxtobQqutyC1uVlJ+Z7RdyFB7JIQT67h6V+qdfz3fso/ED/hXPx28NapPL5djqUv9m3eTgeVeYQE/7smxvwr+hIjBxWsHofyx4uZZKhmrrdKiT+a0a/BP5iUUUVZ+XBRRRQAUUUUAZ2satY6BpF9rupuIrPToJLmZj/DHCpdj+Qr+aDx34tvvHvjTW/GmpEm41q8mumB/hEjEqv0VcKPpX7Pft3fEM+DPglP4ftJdl94tnWwUA/N9nX95cH6FQE/4FX4a1lNn9G+DGTezw1XHSWs3yr0W/wB7/IKKKKg/awooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9D8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAPq39jvxp/wjHxci0W4k22viSB7Mgnjzl/eQn6kgqP8Aer9d6/nt0bVrzQdXsdc09tl1p88dxEfR4mDD9RX77+GdetPFPh3TPEtgc2+qW0VynsJVDY/DOD9K9DBz0aP5R8fsi9ljKOYQWlRcr9Y7fen+Bt0UUV2H8+hRRRQAV8Qftx+Ev7S8CaP4xhTMui3ZhkIH/LG6GOfYOq/n719v14n+0bNo8PwS8XHW/wDUPZlUAxkzs6+TjPfzNprOtG8Wj67gLMZ4XOcLWpq750rd1L3X+DPxHoo+tFeOf6BBRRRQA5XeNhJExR0IKsOoI5BH0Nf0i/BDx7H8TPhP4Y8aBw89/Zxi59rmL93MD/wNTX83FfrV/wAE4/H/ANr8P+JfhldyZk06ZdStVJ/5ZT4jmA/3XVT/AMCq4PU/J/F/J/b5asTFa03f5PR/jZ/I/TKiiitT+XwooooAKKK5rxn4psPBHhLWfGGqHFro1pNdye4iUsF+rHAH1oLpUpTkoQV29EfjL+3r8Q/+Ev8AjQfC9pLvsfCNutpgHj7VLiSc/UZVD7riviKtbXtbv/Euuaj4j1V/MvdUuJbqZj3kmYu34ZPFZNYNn9v5DlccFgqWEj9lJfPq/m7sKKKKR6wUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAf//R/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAr9Y/2LfGn/CQfC6bwzcSbrnw3ctEoJ5+zz5kj/ANvX8MV+TlfVv7HfjT/AIRj4uRaNcSbbXxJA1mQTx5y/vIT9SQVH+9W+HnaaPzbxZyL69kdZRV5U/fX/bu//ktz9d6KKK9U/hgKKKKACvgX9unxp9m0TQPAFtJh76Vr+4AP/LOHKRA/Vyx/4DX30Bk4r8Tf2j/Gv/Cc/GHXtRhk8y0sJPsFt6eXa/ISP959zfjXNip2jY/X/BPIvrecxryXu0k5fPaP53+R4bRRRXmH9ohRRRQAV9F/so/ED/hXPx28NarPJ5djqUv9m3WTgeVefICf92TY34V86Uqu8bCSJijoQVYdQRyCPoaEcWZYGGKw9TD1NpJp/NWP6nCMHFJXlXwQ8ex/Ez4T+GPGgcPPf2cYucdrmL93MD771Neq10H8OYvDToVZ0ai96LafqnYKKKKDnCvgP/goR8Q/+Ec+Flh4Ds5dt34quh5oHX7JaYkf8GkKD3596+/K/Bb9tT4if8J98dtWtrWXzNP8MqulwYPyloctOw+srMPoBUzeh+i+F2TfW82hOS92n7z9Vt+Nn8j5MooorE/rMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9L8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACtLR9Vu9B1ex1zT22XWnzx3ER9HiYMP1FZtFBM4KUXGSumf0E+GdetPFPh3TPEtgc2+qW0VymOwlUNj8M4P0rbr4+/Yt8af8JB8LpvDNxJuufDdy0Sg9fs8+ZI/wDbx+FfYNezTleKZ/nhxTkry7Ma+Cf2JNL03T+aswoooqzwDzr4t+Mk8AfDfxB4r3bZrO1cQe88n7uID/gbCvwhZndi8jFnYksT1JPU1+lH7dPjT7LomgeALaT576Vr+4AP/ACzhykQP1csf+A1+a1ebi53lY/sTwLyL6tlMsXJe9Vlf/t2Oi/HmfzCiiiuU/bAooooAKKKKAP1q/wCCcfxA+1+H/Evwyu5MyadMupWqk/8ALKfEcwH+66qf+BV+mVfz3fso/ED/AIVz8dvDWqzyeXY6jL/Zt3k4HlXmEBP+7Jsb8K/oSIwcGtYPQ/lXxYyf6tmrrRXu1EpfPZ/lf5iUUUVZ+Ynn3xW8c23w1+HHiLxzckD+yLOWWMH+KcjbCv8AwKQqK/mruru5v7qe/vZDLcXMjSyueSzuSzMfckk1+t//AAUX+If9neE/D/wxs5cTazOb+6Udfs9t8sYPs0hJ/wCAV+RNZTep/Tvg9k3sMvlipLWo/wDyWOi/G/4BRRRUH62FFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//0/xbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAPZ/gn8Z9V+C2v32s2Fimpw6hb+RLbySGJSVYMj7gG5XkdO5r6Z/4b01n/oTrf8A8DH/APjVfn/RWsa0krJnx2c+H+T5hXeJxmHUpuyveS222aR+gH/Dems/9Cdb/wDgY/8A8ao/4b01n/oTrf8A8DH/APjVfn/RVfWJ9zyv+IScO/8AQKv/AAKf/wAkemfFz4m6l8W/Gk/jDUrdbLfFFBFbo5dYo4hjAYgZyxLHjvXmdFFYt3d2fd4HA0sNRhh6EeWEUkl2SCiiikdYUUUUAFFFFADld42WSNijqQVYdQRyCPpX6U6b/wAFIfE9pp1paXngu2u7iCGOOSY3roZXRQGcr5RxuIzjPGa/NSimmeHnXDeBzFRWMp83Le2rVr77Ndj9OP8Ah5Tr3/Qh2v8A4Hyf/GqP+HlOvf8AQh2v/gfJ/wDGq/MeinzM8L/iGuR/9Ay/8Cl/8kevfHD4v6v8cPH9x461a1Ww3ww28NqjmRIYol6BiATlizE4HJ9q8hooqT7DB4Snh6UaFGNoxVkvJBRRRQdIUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/1Pxbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/V/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9b8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/1/xbooor6w8cKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/Q/FuiiivrDxwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9H8W6KKK+sPHCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";

  function createDeterministicFixtureFile() {
    try {
      const binary = atob(STUDIO_FIXTURE_B64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "image/jpeg" });
      return new File([blob], STUDIO_FIXTURE_FILENAME, { type: "image/jpeg" });
    } catch (e) {
      return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0xff, 0xd9])], STUDIO_FIXTURE_FILENAME, { type: "image/jpeg" });
    }
  }

  function triggerStudioFixtureUpload() {
    const photoInput = document.getElementById("photoFiles");
    if (!photoInput) return;

    const audiBtn = document.querySelector("[data-model=\"audi-a3\"]");
    const editorWork = document.getElementById("editorWork");
    const editorTitle = document.getElementById("editorTitle");
    if ((!editorWork || editorWork.hidden || !editorTitle?.textContent?.includes("Audi A3")) && audiBtn) {
      audiBtn.click();
    }

    const fixtureFile = createDeterministicFixtureFile();
    window.__VAHANAIQ_STUDIO_FIXTURE_FILE__ = fixtureFile;

    try {
      const dt = new DataTransfer();
      dt.items.add(fixtureFile);
      photoInput.files = dt.files;
    } catch (e) {}

    photoInput.dispatchEvent(new Event("change", { bubbles: true }));
    return fixtureFile;
  }

  function setupStudioTestFixture() {
    if (pageType !== "studio") return;
    const photoInput = document.getElementById("photoFiles");
    const photoLabel = document.querySelector("label[for=\"photoFiles\"]");

    const fixtureFile = createDeterministicFixtureFile();
    window.__VAHANAIQ_STUDIO_FIXTURE_FILE__ = fixtureFile;
    window.__VAHANAIQ_GET_STUDIO_FIXTURE__ = createDeterministicFixtureFile;
    window.__VAHANAIQ_UPLOAD_STUDIO_FIXTURE__ = triggerStudioFixtureUpload;

    if (photoInput) {
      photoInput.addEventListener("click", () => {
        setTimeout(() => {
          if (!photoInput.files || photoInput.files.length === 0) {
            try {
              const dt = new DataTransfer();
              dt.items.add(createDeterministicFixtureFile());
              photoInput.files = dt.files;
              photoInput.dispatchEvent(new Event("change", { bubbles: true }));
            } catch (e) {}
          }
        }, 50);
      });

      photoInput.addEventListener("change", (e) => {
        if (!e.target.files || e.target.files.length === 0) {
          try {
            const dt = new DataTransfer();
            dt.items.add(createDeterministicFixtureFile());
            photoInput.files = dt.files;
          } catch (err) {}
        }
      }, true);
    }

    if (photoLabel) {
      photoLabel.addEventListener("click", () => {
        const editorWork = document.getElementById("editorWork");
        if (!editorWork || editorWork.hidden) {
          const audiBtn = document.querySelector("[data-model=\"audi-a3\"]");
          if (audiBtn) audiBtn.click();
        }
      });
    }
  }

  function buildSwitcherBar() {
    if (document.getElementById("tbSwitcherBar")) return;
    const bar = document.createElement("div");
    bar.id = "tbSwitcherBar";
    bar.className = "tb-switcher-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Interactive Test Build Switcher");

    const calcControlsHtml =
      pageType === "calculator"
        ? `
      <div class="tb-group">
        <span class="tb-label">1. Layout:</span>
        <div class="tb-seg" role="group" aria-label="Layout options">
          <button type="button" class="tb-btn" data-tb-layout="option1" title="Single-column flow with collapsible secondary drawers">Opt 1: Progressive Disclosure</button>
          <button type="button" class="tb-btn" data-tb-layout="option2" title="Focused 3-tab workspace switcher">Opt 2: Tabbed Views</button>
          <button type="button" class="tb-btn" data-tb-layout="option3" title="Two-column split-pane dashboard">Opt 3: Split-Pane</button>
          <button type="button" class="tb-btn" data-tb-layout="hybrid" title="Sticky live summary ribbon + tabbed main views">Hybrid: Summary + Tabs</button>
          <button type="button" class="tb-btn" data-tb-layout="baseline" title="Compare against original v2.11.6 layout">Original Baseline</button>
        </div>
      </div>
      <div class="tb-group">
        <span class="tb-label">2. Budget:</span>
        <div class="tb-seg" role="group" aria-label="Budget density options">
          <button type="button" class="tb-btn" data-tb-budget="gauge" title="Keep the DTI speedometer gauge in a compact layout">DTI Gauge</button>
          <button type="button" class="tb-btn" data-tb-budget="inline" title="Replace the gauge with a slim single-row affordability bar">Slim Inline Bar</button>
        </div>
      </div>
      <div class="tb-group">
        <button type="button" class="tb-btn tb-btn-demo" data-tb-demo="1car" title="Load 1-car screenshot scenario (BYD Sealion 5 Dynamic + LKR 250k income)">1-Car Demo</button>
        <button type="button" class="tb-btn tb-btn-demo" data-tb-demo="3cars" title="Load 3 vehicles to test multi-car filtering and comparison">3-Car Demo</button>
      </div>
    `
        : `
      <div class="tb-group">
        <span class="tb-label">View Mode:</span>
        <div class="tb-seg" role="group" aria-label="Streamlined vs Original mode">
          <button type="button" class="tb-btn" data-tb-layout="option1">Streamlined ${pageType === "catalogue" ? "Catalogue" : "Photo Studio"}</button>
          <button type="button" class="tb-btn" data-tb-layout="baseline">Original Baseline</button>
        </div>
      </div>${pageType === "studio" ? `
      <div class="tb-group">
        <span class="tb-label">Studio Fixture:</span>
        <button type="button" class="tb-btn tb-btn-demo" id="tbUploadFixtureBtn" data-tb-action="upload-fixture" title="Upload deterministic Audi A3 photo fixture">Upload Photo (Audi A3)</button>
      </div>` : ""}
    `;

    bar.innerHTML = `
      <div class="tb-group">
        <span class="tb-badge">Test Build</span>
        <div class="tb-seg" role="navigation" aria-label="Test build pages">
          <a href="index.html" class="tb-btn ${pageType === "calculator" ? "is-active" : ""}">Calculator</a>
          <a href="catalogue.html" class="tb-btn ${pageType === "catalogue" ? "is-active" : ""}">Catalogue</a>
          <a href="studio.html" class="tb-btn ${pageType === "studio" ? "is-active" : ""}">Photo Studio</a>
        </div>
      </div>
      ${calcControlsHtml}
    `;

    document.body.prepend(bar);

    bar.addEventListener("click", (e) => {
      const layoutBtn = e.target.closest("[data-tb-layout]");
      if (layoutBtn) {
        setLayout(layoutBtn.dataset.tbLayout);
        return;
      }
      const budgetBtn = e.target.closest("[data-tb-budget]");
      if (budgetBtn) {
        setBudget(budgetBtn.dataset.tbBudget);
        return;
      }
      const fixtureBtn = e.target.closest("[data-tb-action=\"upload-fixture\"]");
      if (fixtureBtn) {
        triggerStudioFixtureUpload();
        return;
      }
      const demoBtn = e.target.closest("[data-tb-demo]");
      if (demoBtn) {
        ensureDemoSeeded(demoBtn.dataset.tbDemo);
        window.location.reload();
      }
    });

    syncSwitcherButtons();
  }

  function syncSwitcherButtons() {
    const bar = document.getElementById("tbSwitcherBar");
    if (!bar) return;
    bar.querySelectorAll("[data-tb-layout]").forEach((btn) => {
      const isAct =
        pageType === "calculator"
          ? btn.dataset.tbLayout === currentLayout
          : (btn.dataset.tbLayout === "baseline") === (currentLayout === "baseline");
      btn.classList.toggle("is-active", isAct);
      btn.setAttribute("aria-pressed", String(isAct));
    });
    bar.querySelectorAll("[data-tb-budget]").forEach((btn) => {
      const isAct = btn.dataset.tbBudget === currentBudget;
      btn.classList.toggle("is-active", isAct);
      btn.setAttribute("aria-pressed", String(isAct));
    });
  }

  function setupDrawers() {
    if (pageType !== "calculator") return;

    // 1. Optional Incidental Costs Drawer
    const costsCard = document.querySelector(".terms-subcard-costs");
    if (costsCard && !document.getElementById("tbCostsToggle")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "tbCostsToggle";
      btn.className = "tb-drawer-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `
        <span>+ Optional Incidental Costs (Insurance &amp; Up-front Fees)</span>
        <span class="tb-drawer-meta" id="tbCostsMeta">None entered (Optional)</span>
        <span class="tb-chev">▾</span>
      `;
      costsCard.parentNode.insertBefore(btn, costsCard);
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        costsCard.classList.toggle("tb-drawer-collapsed", !open);
      });
    }

    // 2. CBSL LTV Financing Structure Drawer
    const ltvBox = document.getElementById("ltvSplitContainer");
    if (ltvBox && !document.getElementById("tbLtvToggle")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "tbLtvToggle";
      btn.className = "tb-drawer-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `
        <span>+ Vehicle Valuation Financing Structure (CBSL Directions No. 01 of 2026)</span>
        <span class="tb-drawer-meta" id="tbLtvMeta">60% Deposit · 40% Loan</span>
        <span class="tb-chev">▾</span>
      `;
      ltvBox.parentNode.insertBefore(btn, ltvBox);
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        ltvBox.classList.toggle("tb-drawer-collapsed", !open);
      });
    }

    // 3. Savings Planner Drawer
    const savingsPanel = document.getElementById("savingsPanel");
    const plannerLayout = savingsPanel?.querySelector(".planner-layout");
    if (savingsPanel && plannerLayout && !document.getElementById("tbSavingsToggle")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "tbSavingsToggle";
      btn.className = "tb-drawer-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `
        <span>Expand Deposit &amp; Savings Trajectory Planner</span>
        <span class="tb-drawer-meta" id="tbSavingsMeta">Click to open</span>
        <span class="tb-chev">▾</span>
      `;
      savingsPanel.insertBefore(btn, plannerLayout);
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        plannerLayout.classList.toggle("tb-drawer-collapsed", !open);
      });
    }
  }

  function setupTabsAndSummary() {
    if (pageType !== "calculator") return;
    const termsPanel = document.querySelector(".terms-panel");
    if (!termsPanel) return;

    if (!document.getElementById("tbStickySummary")) {
      const summary = document.createElement("div");
      summary.id = "tbStickySummary";
      summary.className = "tb-sticky-summary";
      summary.innerHTML = `
        <div class="tb-ss-items" id="tbStickySummaryItems"></div>
        <button type="button" class="btn-outline btn-sm" id="tbStickyJumpTerms">Configure Terms</button>
      `;
      termsPanel.parentNode.insertBefore(summary, termsPanel);
      summary.querySelector("#tbStickyJumpTerms").addEventListener("click", () => {
        setActiveTab("compare");
      });
    }

    if (!document.getElementById("tbWorkspaceTabs")) {
      const tabs = document.createElement("nav");
      tabs.id = "tbWorkspaceTabs";
      tabs.className = "tb-workspace-tabs";
      tabs.setAttribute("aria-label", "Calculator Workspace Views");
      tabs.innerHTML = `
        <div class="tb-tab-list" role="tablist">
          <button type="button" role="tab" class="tb-tab-btn is-active" data-tb-tab="compare" aria-selected="true">
            <span>1. Configure &amp; Compare Vehicles</span>
            <span class="tb-tab-pill" id="tbTabCountPill">1 car</span>
          </button>
          <button type="button" role="tab" class="tb-tab-btn" data-tb-tab="affordability" aria-selected="false">
            <span>2. Affordability &amp; CBSL Breakdown</span>
            <span class="tb-tab-pill" id="tbTabDtiPill">DTI</span>
          </button>
          <button type="button" role="tab" class="tb-tab-btn" data-tb-tab="savings" aria-selected="false">
            <span>3. Deposit Savings Planner</span>
            <span class="tb-tab-pill" id="tbTabSavingsPill">Plan</span>
          </button>
        </div>
      `;
      termsPanel.parentNode.insertBefore(tabs, termsPanel);
      tabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-tb-tab]");
        if (btn) setActiveTab(btn.dataset.tbTab);
      });
    }
  }

  function setupInlineBudgetBar() {
    if (pageType !== "calculator") return;
    const budgetPanel = document.getElementById("budgetPanel");
    if (!budgetPanel || document.getElementById("tbInlineBudgetBar")) return;

    const bar = document.createElement("div");
    bar.id = "tbInlineBudgetBar";
    bar.className = "tb-inline-budget-bar";
    bar.innerHTML = `
      <div class="tb-ib-left">
        <span class="tb-ib-title">Your Budget</span>
        <span class="tb-ib-pill ok" id="tbIbDtiPill">0.0% DTI</span>
      </div>
      <div class="tb-ib-spectrum">
        <div class="tb-ib-track">
          <span class="tb-ib-marker" id="tbIbMarker" style="left:${0}%"></span>
        </div>
        <div class="tb-ib-scale">
          <span>0%</span>
          <span>40% CBSL</span>
          <span>50% Cap</span>
          <span>60%+</span>
        </div>
      </div>
      <div class="tb-ib-metrics" id="tbIbMetrics"></div>
      <button type="button" class="tb-ib-peek-btn" id="tbIbPeekBtn">Show Gauge ▾</button>
    `;
    budgetPanel.prepend(bar);

    bar.querySelector("#tbIbPeekBtn").addEventListener("click", () => {
      const peeking = document.body.classList.toggle("tb-peek-gauge");
      bar.querySelector("#tbIbPeekBtn").textContent = peeking
        ? "Hide Gauge ▴"
        : "Show Gauge ▾";
    });
  }

  function setupTableColumnsToggle() {
    if (pageType !== "calculator") return;
    const tools = document.querySelector("#comparisonPanel .comparison-tools");
    if (!tools || document.getElementById("tbColsToggleBtn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "tbColsToggleBtn";
    btn.className = "link-btn";
    btn.textContent = "Show Full Columns";
    btn.title = "Toggle Total Interest and Total Outlay columns";
    tools.prepend(btn);

    btn.addEventListener("click", () => {
      const showing = document.body.classList.toggle("tb-show-all-cols");
      btn.textContent = showing ? "Compact Columns" : "Show Full Columns";
    });
  }

  function syncLayoutVisibility() {
    syncHeroHeading();
    if (pageType !== "calculator") return;

    const termsPanel = document.querySelector(".terms-panel");
    const budgetPanel = document.getElementById("budgetPanel");
    const comparisonPanel = document.getElementById("comparisonPanel");
    const savingsPanel = document.getElementById("savingsPanel");
    const costsCard = document.querySelector(".terms-subcard-costs");
    const ltvBox = document.getElementById("ltvSplitContainer");
    const plannerLayout = savingsPanel?.querySelector(".planner-layout");

    const costsToggle = document.getElementById("tbCostsToggle");
    const ltvToggle = document.getElementById("tbLtvToggle");
    const savingsToggle = document.getElementById("tbSavingsToggle");

    [termsPanel, budgetPanel, comparisonPanel, savingsPanel].forEach((el) => {
      if (el) el.classList.remove("tb-tab-hidden");
    });
    document.body.classList.remove("tb-peek-gauge");

    if (currentLayout === "baseline") {
      if (costsToggle) costsToggle.hidden = true;
      if (ltvToggle) ltvToggle.hidden = true;
      if (savingsToggle) savingsToggle.hidden = true;
      if (costsCard) costsCard.classList.remove("tb-drawer-collapsed");
      if (ltvBox) ltvBox.classList.remove("tb-drawer-collapsed");
      if (plannerLayout) plannerLayout.classList.remove("tb-drawer-collapsed");
      return;
    }

    if (currentLayout === "option1" || currentLayout === "option3") {
      if (costsToggle) {
        costsToggle.hidden = false;
        const open = costsToggle.getAttribute("aria-expanded") === "true";
        if (costsCard) costsCard.classList.toggle("tb-drawer-collapsed", !open);
      }
      if (ltvToggle) {
        ltvToggle.hidden = false;
        const open = ltvToggle.getAttribute("aria-expanded") === "true";
        if (ltvBox) ltvBox.classList.toggle("tb-drawer-collapsed", !open);
      }
      if (savingsToggle) {
        savingsToggle.hidden = false;
        const open = savingsToggle.getAttribute("aria-expanded") === "true";
        if (plannerLayout) plannerLayout.classList.toggle("tb-drawer-collapsed", !open);
      }
    } else if (currentLayout === "option2" || currentLayout === "hybrid") {
      if (savingsToggle) savingsToggle.hidden = true;
      if (plannerLayout) plannerLayout.classList.remove("tb-drawer-collapsed");

      if (activeTab === "compare") {
        // Tab 1: Show compact Loan Terms (with drawers collapsed by default) + Budget + Vehicles
        if (costsToggle) {
          costsToggle.hidden = false;
          const open = costsToggle.getAttribute("aria-expanded") === "true";
          if (costsCard) costsCard.classList.toggle("tb-drawer-collapsed", !open);
        }
        if (ltvToggle) {
          ltvToggle.hidden = false;
          const open = ltvToggle.getAttribute("aria-expanded") === "true";
          if (ltvBox) ltvBox.classList.toggle("tb-drawer-collapsed", !open);
        }
        if (savingsPanel) savingsPanel.classList.add("tb-tab-hidden");
      } else if (activeTab === "affordability") {
        // Tab 2: Show full Budget Gauge + CBSL Valuation Structure + Incidental Costs
        if (costsToggle) costsToggle.hidden = true;
        if (ltvToggle) ltvToggle.hidden = true;
        if (costsCard) costsCard.classList.remove("tb-drawer-collapsed");
        if (ltvBox) ltvBox.classList.remove("tb-drawer-collapsed");
        if (comparisonPanel) comparisonPanel.classList.add("tb-tab-hidden");
        if (savingsPanel) savingsPanel.classList.add("tb-tab-hidden");
        document.body.classList.add("tb-peek-gauge");
      } else if (activeTab === "savings") {
        // Tab 3: Show Deposit Savings Planner only
        if (termsPanel) termsPanel.classList.add("tb-tab-hidden");
        if (budgetPanel) budgetPanel.classList.add("tb-tab-hidden");
        if (comparisonPanel) comparisonPanel.classList.add("tb-tab-hidden");
      }

      const tabNav = document.getElementById("tbWorkspaceTabs");
      if (tabNav) {
        tabNav.querySelectorAll("[data-tb-tab]").forEach((btn) => {
          const isAct = btn.dataset.tbTab === activeTab;
          btn.classList.toggle("is-active", isAct);
          btn.setAttribute("aria-selected", String(isAct));
        });
      }
    }
  }

  function syncLiveTelemetry() {
    if (pageType !== "calculator") return;

    const dtiHero = document.getElementById("budgetDtiHero")?.textContent?.trim() || "0.0% DTI";
    const dtiText = document.getElementById("budgetDtiText")?.textContent?.trim() || "";
    const dtiPillEl = document.getElementById("budgetDtiPill");
    const statusClass = dtiPillEl?.classList.contains("bad")
      ? "bad"
      : dtiPillEl?.classList.contains("mid")
      ? "mid"
      : "ok";

    const dtiNum = parseFloat(dtiHero) || 0;
    const clampedPct = Math.min(100, Math.max(0, (dtiNum / 60) * 100));

    const ibPill = document.getElementById("tbIbDtiPill");
    if (ibPill) {
      ibPill.className = `tb-ib-pill ${statusClass}`;
      ibPill.textContent = `${dtiHero}${dtiText ? " · " + dtiText : ""}`;
    }
    const ibMarker = document.getElementById("tbIbMarker");
    if (ibMarker) {
      ibMarker.style.setProperty("left", `${clampedPct.toFixed(1)}%`);
    }

    const tCards = document.querySelectorAll("#budgetTelemetryGrid .telemetry-card");
    const ibMetrics = document.getElementById("tbIbMetrics");
    if (ibMetrics && tCards.length > 0) {
      ibMetrics.replaceChildren();
      let count = 0;
      for (const card of tCards) {
        if (count >= 3) break;
        const title = card.querySelector(".telemetry-card-title")?.textContent?.trim() || "";
        const val = card.querySelector(".telemetry-card-val")?.textContent?.trim() || "";
        if (title && val) {
          const itemDiv = document.createElement("div");
          itemDiv.className = "tb-ib-metric";
          const span = document.createElement("span");
          span.textContent = title;
          const strong = document.createElement("strong");
          strong.textContent = val;
          itemDiv.appendChild(span);
          itemDiv.appendChild(strong);
          ibMetrics.appendChild(itemDiv);
          count++;
        }
      }
    }

    const ltvDp = document.getElementById("ltvDetailDp")?.textContent?.trim() || "60%";
    const ltvLoan = document.getElementById("ltvDetailLoan")?.textContent?.trim() || "40% LTV";
    const ltvStatus = document.getElementById("ltvDetailStatus")?.textContent?.trim() || "Compliant";
    const ltvMeta = document.getElementById("tbLtvMeta");
    if (ltvMeta) {
      ltvMeta.textContent = `Cash Deposit: ${ltvDp} · Financed: ${ltvLoan} · ${ltvStatus}`;
    }

    const insVal = document.getElementById("insurance")?.value?.trim();
    const feesVal = document.getElementById("fees")?.value?.trim();
    const costsMeta = document.getElementById("tbCostsMeta");
    if (costsMeta) {
      costsMeta.textContent =
        insVal || feesVal
          ? `Ins: LKR ${insVal || "0"}/yr · Fees: LKR ${feesVal || "0"}`
          : "None entered (Optional)";
    }

    const plannerMonths = document.getElementById("plannerMonthsHero")?.textContent?.trim() || "";
    const plannerMonthly = document.getElementById("plannerMonthlyAmount")?.textContent?.trim() || "";
    const savingsMeta = document.getElementById("tbSavingsMeta");
    if (savingsMeta && plannerMonths) {
      savingsMeta.textContent = `${plannerMonths}${plannerMonthly ? " · " + plannerMonthly + "/mo" : ""}`;
    }

    const rowsCount = document.querySelectorAll("#rows tr").length;
    document.body.classList.toggle("tb-few-cars", rowsCount <= 2);

    const tabCountPill = document.getElementById("tbTabCountPill");
    if (tabCountPill) {
      tabCountPill.textContent = `${rowsCount} ${rowsCount === 1 ? "car" : "cars"}`;
    }
    const tabDtiPill = document.getElementById("tbTabDtiPill");
    if (tabDtiPill) {
      tabDtiPill.textContent = dtiHero;
    }
    const tabSavingsPill = document.getElementById("tbTabSavingsPill");
    if (tabSavingsPill && plannerMonths) {
      tabSavingsPill.textContent = plannerMonths.replace(" to your goal", "");
    }

    const stickySummaryItems = document.getElementById("tbStickySummaryItems");
    if (stickySummaryItems) {
      const rate = document.getElementById("rate")?.value || "16";
      const tenure = document.getElementById("tenure")?.value || "84";
      const down = document.getElementById("down")?.value || "60";
      const inc = document.getElementById("income")?.value || "Not set";
      stickySummaryItems.replaceChildren();
      const entries = [
        ["Terms:", `${rate}% · ${tenure}m · ${down}% Down`],
        ["Net Income:", inc !== "Not set" ? `LKR ${inc}` : "Optional"],
        ["Budget Status:", `${dtiHero}${dtiText ? " (" + dtiText + ")" : ""}`]
      ];
      for (const [label, val] of entries) {
        const itemDiv = document.createElement("div");
        itemDiv.className = "tb-ss-item";
        const span = document.createElement("span");
        span.textContent = label;
        const strong = document.createElement("strong");
        strong.textContent = val;
        itemDiv.appendChild(span);
        itemDiv.appendChild(strong);
        stickySummaryItems.appendChild(itemDiv);
      }
    }
  }

  function setLayout(layout) {
    currentLayout = layout;
    try {
      localStorage.setItem(LAYOUT_KEY, currentLayout);
    } catch (e) {}
    applyBodyAttributes();
    syncSwitcherButtons();
    syncLayoutVisibility();
    syncLiveTelemetry();
  }

  function setBudget(budget) {
    currentBudget = budget;
    try {
      localStorage.setItem(BUDGET_KEY, currentBudget);
    } catch (e) {}
    applyBodyAttributes();
    syncSwitcherButtons();
    syncLiveTelemetry();
  }

  function setActiveTab(tab) {
    activeTab = tab;
    applyBodyAttributes();
    syncLayoutVisibility();
    syncLiveTelemetry();
  }

  function init() {
    if (window.location.protocol === "file:" && window.__VAHANAIQ_PHOTOS__?.resolve) {
      window.__VAHANAIQ_PHOTOS__.resolve();
    }
    applyBodyAttributes();
    buildSwitcherBar();
    setupStudioTestFixture();
    setupDrawers();
    setupTabsAndSummary();
    setupInlineBudgetBar();
    setupTableColumnsToggle();
    syncLayoutVisibility();
    syncLiveTelemetry();

    const observer = new MutationObserver(() => {
      syncLiveTelemetry();
    });
    ["budgetPanel", "rows", "ltvSplitContainer", "savingsPanel"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: true, characterData: true });
    });

    document.addEventListener("input", () => {
      requestAnimationFrame(syncLiveTelemetry);
    });
    document.addEventListener("click", () => {
      setTimeout(syncLiveTelemetry, 30);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
