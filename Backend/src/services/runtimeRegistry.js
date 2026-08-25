import ProjectFile from "../models/ProjectFile.js";

/**
 * Extensible Framework Registry
 * Defines detection rules, default start commands, ports, and metadata for modern web runtimes.
 */
export const FRAMEWORKS = [
  // -------------------------------------------------------------
  // Node.js / JavaScript / TypeScript Frontend & Fullstack
  // -------------------------------------------------------------
  {
    id: "vite-react",
    name: "Vite (React)",
    category: "frontend",
    runtime: "node",
    icon: "react",
    description: "Vite Next Generation Frontend Tooling with React",
    defaultPort: 5173,
    commonPorts: [5173, 3000, 8080],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx vite --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return (deps["vite"] || files.some((f) => f.name.includes("vite.config"))) && (deps["react"] || files.some((f) => f.name.endsWith(".tsx") || f.name.endsWith(".jsx")));
    },
  },
  {
    id: "vite-vue",
    name: "Vite (Vue)",
    category: "frontend",
    runtime: "node",
    icon: "vue",
    description: "Vite with Vue 3 Single File Components",
    defaultPort: 5173,
    commonPorts: [5173, 8080],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx vite --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return (deps["vite"] || files.some((f) => f.name.includes("vite.config"))) && (deps["vue"] || files.some((f) => f.name.endsWith(".vue")));
    },
  },
  {
    id: "vite-svelte",
    name: "Vite (Svelte)",
    category: "frontend",
    runtime: "node",
    icon: "svelte",
    description: "Vite with Svelte Components",
    defaultPort: 5173,
    commonPorts: [5173, 5000],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx vite --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return (deps["vite"] || deps["@sveltejs/vite-plugin-svelte"]) && (deps["svelte"] || files.some((f) => f.name.endsWith(".svelte")));
    },
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "fullstack",
    runtime: "node",
    icon: "nextjs",
    description: "Next.js Fullstack React Framework",
    defaultPort: 3000,
    commonPorts: [3000, 3001, 8080],
    defaultCommand: "npm run dev -- -H 0.0.0.0",
    fallbackCommand: "npx next dev -H 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["next"] || files.some((f) => f.name.includes("next.config")));
    },
  },
  {
    id: "nuxt",
    name: "Nuxt",
    category: "fullstack",
    runtime: "node",
    icon: "nuxt",
    description: "Nuxt Intuitive Vue Framework",
    defaultPort: 3000,
    commonPorts: [3000, 3001],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx nuxt dev --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["nuxt"] || deps["nuxt3"] || files.some((f) => f.name.includes("nuxt.config")));
    },
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    category: "fullstack",
    runtime: "node",
    icon: "svelte",
    description: "SvelteKit Web Application Framework",
    defaultPort: 5173,
    commonPorts: [5173, 3000],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx vite dev --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["@sveltejs/kit"] || files.some((f) => f.name.includes("svelte.config")));
    },
  },
  {
    id: "angular",
    name: "Angular",
    category: "frontend",
    runtime: "node",
    icon: "angular",
    description: "Angular Enterprise Web Framework",
    defaultPort: 4200,
    commonPorts: [4200, 8080],
    defaultCommand: "npm start -- --host 0.0.0.0",
    fallbackCommand: "npx ng serve --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["@angular/core"] || files.some((f) => f.name.includes("angular.json")));
    },
  },
  {
    id: "astro",
    name: "Astro",
    category: "fullstack",
    runtime: "node",
    icon: "astro",
    description: "Astro Content-driven Web Framework",
    defaultPort: 4321,
    commonPorts: [4321, 3000],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx astro dev --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["astro"] || files.some((f) => f.name.includes("astro.config")));
    },
  },
  {
    id: "express-node",
    name: "Express.js / Node API",
    category: "backend",
    runtime: "node",
    icon: "node",
    description: "Node.js Express / Fastify / Nest REST API",
    defaultPort: 5000,
    commonPorts: [5000, 3000, 8000, 8080],
    defaultCommand: "npm run dev",
    fallbackCommand: "node server.js",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(
        deps["express"] ||
        deps["fastify"] ||
        deps["@nestjs/core"] ||
        deps["koa"] ||
        files.some((f) => f.name === "server.js" || f.name === "app.js")
      );
    },
  },
  {
    id: "generic-vite",
    name: "Vite (Vanilla / Generic)",
    category: "frontend",
    runtime: "node",
    icon: "vite",
    description: "Vite Frontend Development Environment",
    defaultPort: 5173,
    commonPorts: [5173, 3000, 8080],
    defaultCommand: "npm run dev -- --host 0.0.0.0",
    fallbackCommand: "npx vite --host 0.0.0.0",
    match: (files, pkg) => {
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      return Boolean(deps["vite"] || files.some((f) => f.name.includes("vite.config")));
    },
  },

  // -------------------------------------------------------------
  // Python Web Frameworks & Platforms
  // -------------------------------------------------------------
  {
    id: "fastapi",
    name: "FastAPI",
    category: "backend",
    runtime: "python",
    icon: "fastapi",
    description: "FastAPI Modern High-Performance Async Python Web API",
    defaultPort: 8000,
    commonPorts: [8000, 8080, 5000],
    defaultCommand: "uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    fallbackCommand: "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    match: (files, pkg, pyDeps, pyContent) => {
      if (pyDeps.includes("fastapi") || pyDeps.includes("uvicorn")) return true;
      return pyContent.includes("from fastapi") || pyContent.includes("import FastAPI");
    },
  },
  {
    id: "flask",
    name: "Flask",
    category: "backend",
    runtime: "python",
    icon: "flask",
    description: "Flask Lightweight Python Web Framework",
    defaultPort: 5000,
    commonPorts: [5000, 8000, 8080],
    defaultCommand: "python -m flask run --host=0.0.0.0 --port=5000 --debug",
    fallbackCommand: "python app.py",
    match: (files, pkg, pyDeps, pyContent) => {
      if (pyDeps.includes("flask")) return true;
      return pyContent.includes("from flask import") || pyContent.includes("import Flask");
    },
  },
  {
    id: "django",
    name: "Django",
    category: "fullstack",
    runtime: "python",
    icon: "django",
    description: "Django Batteries-Included Fullstack Python Web Framework",
    defaultPort: 8000,
    commonPorts: [8000, 8080],
    defaultCommand: "python manage.py runserver 0.0.0.0:8000",
    fallbackCommand: "python manage.py runserver 0.0.0.0:8000",
    match: (files, pkg, pyDeps, pyContent) => {
      if (files.some((f) => f.name === "manage.py" || f.name === "settings.py" || f.name === "wsgi.py")) return true;
      return pyDeps.includes("django") || pyContent.includes("import django");
    },
  },
  {
    id: "streamlit",
    name: "Streamlit",
    category: "data-app",
    runtime: "python",
    icon: "streamlit",
    description: "Streamlit Interactive Data & ML Application Platform",
    defaultPort: 8501,
    commonPorts: [8501, 8080],
    defaultCommand: "streamlit run app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true",
    fallbackCommand: "python -m streamlit run app.py --server.port 8501 --server.address 0.0.0.0",
    match: (files, pkg, pyDeps, pyContent) => {
      if (pyDeps.includes("streamlit") || files.some((f) => f.name === "streamlit_app.py")) return true;
      return pyContent.includes("import streamlit as st") || pyContent.includes("from streamlit import");
    },
  },
  {
    id: "dash-plotly",
    name: "Plotly Dash",
    category: "data-app",
    runtime: "python",
    icon: "dash",
    description: "Plotly Dash Analytic Web Apps for Python",
    defaultPort: 8050,
    commonPorts: [8050, 8080],
    defaultCommand: "python app.py",
    fallbackCommand: "python main.py",
    match: (files, pkg, pyDeps, pyContent) => {
      if (pyDeps.includes("dash")) return true;
      return pyContent.includes("import dash") || pyContent.includes("from dash import");
    },
  },
  {
    id: "gradio",
    name: "Gradio",
    category: "data-app",
    runtime: "python",
    icon: "gradio",
    description: "Gradio Machine Learning UI Framework",
    defaultPort: 7860,
    commonPorts: [7860, 8080],
    defaultCommand: "python app.py",
    fallbackCommand: "python main.py",
    match: (files, pkg, pyDeps, pyContent) => {
      if (pyDeps.includes("gradio")) return true;
      return pyContent.includes("import gradio as gr") || pyContent.includes("from gradio import");
    },
  },
  {
    id: "generic-python",
    name: "Python Web Application",
    category: "backend",
    runtime: "python",
    icon: "python",
    description: "Generic Python Web Server or Script",
    defaultPort: 8000,
    commonPorts: [8000, 5000, 8080],
    defaultCommand: "python app.py",
    fallbackCommand: "python main.py",
    match: (files) => {
      return files.some((f) => f.name.endsWith(".py") || f.name === "requirements.txt");
    },
  },

  // -------------------------------------------------------------
  // Static HTML / CSS / JS Web Application
  // -------------------------------------------------------------
  {
    id: "static-html",
    name: "Static HTML / Web Site",
    category: "static",
    runtime: "node",
    icon: "html",
    description: "HTML5, CSS3, and JavaScript Web Application",
    defaultPort: 3000,
    commonPorts: [3000, 8080, 5000],
    defaultCommand: "npx serve -s . -l 3000",
    fallbackCommand: "npx http-server -p 3000 .",
    match: (files) => {
      return files.some((f) => f.name.toLowerCase() === "index.html" || f.name.endsWith(".html"));
    },
  },
];

/**
 * Extensible Runtime Registry Service
 */
class RuntimeRegistryService {
  constructor() {
    this.frameworks = FRAMEWORKS;
  }

  /**
   * Register a custom framework descriptor dynamically
   */
  registerFramework(frameworkDef) {
    if (!frameworkDef.id || !frameworkDef.name || !frameworkDef.defaultPort) {
      throw new Error("Invalid framework definition: missing required id, name, or defaultPort.");
    }
    const index = this.frameworks.findIndex((f) => f.id === frameworkDef.id);
    if (index >= 0) {
      this.frameworks[index] = frameworkDef;
    } else {
      this.frameworks.unshift(frameworkDef);
    }
  }

  /**
   * Analyze project files and detect framework, start command, and port configurations
   */
  async detectProjectFramework(projectId) {
    try {
      const files = await ProjectFile.find({ projectId }).select("name path content type");
      
      // Parse package.json if present
      let pkgJson = null;
      const pkgFile = files.find((f) => f.name === "package.json");
      if (pkgFile && pkgFile.content) {
        try {
          pkgJson = JSON.parse(pkgFile.content);
        } catch {
          // invalid json, ignore
        }
      }

      // Collect Python dependencies and content snippet
      let pyDeps = [];
      const reqFile = files.find((f) => f.name === "requirements.txt" || f.name === "Pipfile" || f.name === "pyproject.toml");
      if (reqFile && reqFile.content) {
        pyDeps = reqFile.content
          .toLowerCase()
          .split(/[\r\n]+/)
          .map((l) => l.trim().split(/[=><~]/)[0].trim());
      }

      const pythonFiles = files.filter((f) => f.name.endsWith(".py") && f.content);
      const combinedPythonContent = pythonFiles.map((f) => f.content).join("\n");

      // Match against registered frameworks in order
      for (const fw of this.frameworks) {
        if (fw.match(files, pkgJson, pyDeps, combinedPythonContent)) {
          // Check package.json scripts for custom dev command
          let startCommand = fw.defaultCommand;
          if (pkgJson && pkgJson.scripts) {
            if (pkgJson.scripts.dev) {
              startCommand = "npm run dev";
            } else if (pkgJson.scripts.start) {
              startCommand = "npm start";
            } else if (pkgJson.scripts.serve) {
              startCommand = "npm run serve";
            }
          }

          // If Python main file is app.py vs main.py vs server.py
          if (fw.runtime === "python") {
            const hasAppPy = files.some((f) => f.name === "app.py");
            const hasMainPy = files.some((f) => f.name === "main.py");
            const hasServerPy = files.some((f) => f.name === "server.py");

            if (fw.id === "fastapi") {
              if (hasAppPy && !hasMainPy) {
                startCommand = "uvicorn app:app --reload --host 0.0.0.0 --port 8000";
              }
            } else if (fw.id === "flask" || fw.id === "generic-python") {
              if (hasMainPy && !hasAppPy) {
                startCommand = "python main.py";
              } else if (hasServerPy && !hasAppPy) {
                startCommand = "python server.py";
              }
            } else if (fw.id === "streamlit") {
              const streamlitFile = files.find((f) => f.name === "streamlit_app.py" || f.name === "app.py" || f.name === "main.py");
              const targetName = streamlitFile ? streamlitFile.name : "app.py";
              startCommand = `streamlit run ${targetName} --server.port 8501 --server.address 0.0.0.0 --server.headless true`;
            }
          }

          return {
            id: fw.id,
            name: fw.name,
            category: fw.category,
            runtime: fw.runtime,
            icon: fw.icon,
            description: fw.description,
            defaultPort: fw.defaultPort,
            commonPorts: fw.commonPorts || [fw.defaultPort],
            startCommand,
            fallbackCommand: fw.fallbackCommand,
            scripts: pkgJson?.scripts || {},
          };
        }
      }

      // Default generic fallback
      return {
        id: "generic-web",
        name: "Web Application",
        category: "frontend",
        runtime: "node",
        icon: "globe",
        description: "Generic Web Application",
        defaultPort: 3000,
        commonPorts: [3000, 5173, 8000, 8080],
        startCommand: "npm run dev",
        fallbackCommand: "npx serve -l 3000 .",
        scripts: pkgJson?.scripts || {},
      };
    } catch (err) {
      console.error("detectProjectFramework error:", err);
      return {
        id: "generic-web",
        name: "Web Application",
        category: "frontend",
        runtime: "node",
        icon: "globe",
        description: "Generic Web Application",
        defaultPort: 5173,
        commonPorts: [5173, 3000, 8000, 8080],
        startCommand: "npm run dev",
        fallbackCommand: "npx serve -l 3000 .",
        scripts: {},
      };
    }
  }
}

export const runtimeRegistry = new RuntimeRegistryService();
export default runtimeRegistry;
