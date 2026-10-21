import Project from "../models/Project.js";
import ProjectFile from "../models/ProjectFile.js";
import User from "../models/User.js";
import containerService from "../services/containerService.js";

export const createProject = async (req, res) => {
  try {
    const { name, description, template = "node", envVariables = [] } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Project name is required",
      });
    }

    const userId = req.user._id || req.user.id;

    const project = await Project.create({
      name,
      description,
      owner: userId,
      template,
      envVariables,
    });

    // Automatically seed starter files based on chosen language runtime
    const defaultName = (name || "cloudforge-app").toLowerCase().replace(/[^a-z0-9]/g, "-");
    let starterFiles = [];

    switch (template) {
      case "python":
        starterFiles = [
          {
            name: "main.py",
            path: "/main.py",
            type: "file",
            language: "python",
            mimeType: "text/x-python",
            content: `# CloudForge Cloud Workspace - Python 3.11 Runtime\n\ndef main():\n    print("CloudForge Python runtime active.")\n    print("Hello from /workspace/main.py!")\n\nif __name__ == "__main__":\n    main()\n`,
          },
          {
            name: "requirements.txt",
            path: "/requirements.txt",
            type: "file",
            language: "text",
            mimeType: "text/plain",
            content: `# Add Python dependencies here\nrequests>=2.31.0\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Python 3.11 cloud workspace on CloudForge."}\n\n## Getting Started\n\nRun your Python script in the cloud terminal:\n\`\`\`bash\npython3 main.py\n\`\`\`\n\nInstall dependencies:\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n`,
          },
        ];
        break;

      case "go":
        starterFiles = [
          {
            name: "main.go",
            path: "/main.go",
            type: "file",
            language: "go",
            mimeType: "text/x-go",
            content: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("CloudForge Go 1.22 runtime active.")\n\tfmt.Println("Hello from /workspace/main.go!")\n}\n`,
          },
          {
            name: "go.mod",
            path: "/go.mod",
            type: "file",
            language: "text",
            mimeType: "text/plain",
            content: `module ${defaultName}\n\ngo 1.22\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Go workspace on CloudForge."}\n\n## Getting Started\n\nRun the Go app in the cloud terminal:\n\`\`\`bash\ngo run main.go\n\`\`\`\n`,
          },
        ];
        break;

      case "rust":
        starterFiles = [
          {
            name: "main.rs",
            path: "/main.rs",
            type: "file",
            language: "rust",
            mimeType: "text/x-rust",
            content: `fn main() {\n    println!("CloudForge Rust runtime active.");\n    println!("Hello from /workspace/main.rs!");\n}\n`,
          },
          {
            name: "Cargo.toml",
            path: "/Cargo.toml",
            type: "file",
            language: "toml",
            mimeType: "text/plain",
            content: `[package]\nname = "${defaultName}"\nversion = "0.1.0"\nedition = "2021"\n\n[[bin]]\nname = "app"\npath = "main.rs"\n\n[dependencies]\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Rust workspace on CloudForge."}\n\n## Getting Started\n\nCompile and run in the terminal:\n\`\`\`bash\ncargo run\n\`\`\`\n`,
          },
        ];
        break;

      case "cpp":
        starterFiles = [
          {
            name: "main.cpp",
            path: "/main.cpp",
            type: "file",
            language: "cpp",
            mimeType: "text/x-c++src",
            content: `#include <iostream>\n\nint main() {\n    std::cout << "CloudForge C++ (GCC) runtime active." << std::endl;\n    std::cout << "Hello from /workspace/main.cpp!" << std::endl;\n    return 0;\n}\n`,
          },
          {
            name: "Makefile",
            path: "/Makefile",
            type: "file",
            language: "makefile",
            mimeType: "text/plain",
            content: `all:\n\tg++ -O2 main.cpp -o app\n\nrun: all\n\t./app\n\nclean:\n\trm -f app\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "C/C++ workspace on CloudForge."}\n\n## Getting Started\n\nCompile and run:\n\`\`\`bash\nmake run\n\`\`\`\n`,
          },
        ];
        break;

      case "java":
        starterFiles = [
          {
            name: "Main.java",
            path: "/Main.java",
            type: "file",
            language: "java",
            mimeType: "text/x-java-source",
            content: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("CloudForge Java 17 runtime active.");\n        System.out.println("Hello from /workspace/Main.java!");\n    }\n}\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Java 17 (OpenJDK) workspace on CloudForge."}\n\n## Getting Started\n\nCompile and execute:\n\`\`\`bash\njavac Main.java && java Main\n\`\`\`\n`,
          },
        ];
        break;

      case "web":
        starterFiles = [
          {
            name: "index.html",
            path: "/index.html",
            type: "file",
            language: "html",
            mimeType: "text/html",
            content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="card">\n    <h1>${name}</h1>\n    <p>Running live on CloudForge Cloud Workspace.</p>\n    <button id="actionBtn">Click Me</button>\n  </div>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
          },
          {
            name: "style.css",
            path: "/style.css",
            type: "file",
            language: "css",
            mimeType: "text/css",
            content: `body {\n  margin: 0;\n  min-height: 100vh;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  background: #000000;\n  color: #ffffff;\n  font-family: system-ui, -apple-system, sans-serif;\n}\n.card {\n  text-align: center;\n  padding: 2.5rem;\n  border: 1px solid #262626;\n  border-radius: 1rem;\n  background: #0d1117;\n}\nbutton {\n  margin-top: 1rem;\n  padding: 0.6rem 1.4rem;\n  background: #2563eb;\n  color: #fff;\n  border: none;\n  border-radius: 0.5rem;\n  font-weight: 600;\n  cursor: pointer;\n}\n`,
          },
          {
            name: "app.js",
            path: "/app.js",
            type: "file",
            language: "javascript",
            mimeType: "application/javascript",
            content: `document.getElementById("actionBtn")?.addEventListener("click", () => {\n  alert("Hello from CloudForge Static Web Workspace!");\n});\nconsole.log("CloudForge Web App ready.");\n`,
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Frontend static web workspace on CloudForge."}\n\n## Getting Started\n\nEdit \`index.html\`, \`style.css\`, and \`app.js\`.\nRun a local server via:\n\`\`\`bash\nnpx serve .\n\`\`\`\n`,
          },
        ];
        break;

      case "blank":
        starterFiles = [
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Custom workspace on CloudForge."}\n\nCreate files using the explorer on the left or run commands in the terminal.\n`,
          },
        ];
        break;

      case "node":
      default:
        starterFiles = [
          {
            name: "index.js",
            path: "/index.js",
            type: "file",
            language: "javascript",
            mimeType: "application/javascript",
            content: `// CloudForge Cloud Workspace - Node.js 20 & TypeScript Runtime\nconsole.log("CloudForge container runtime active.");\n\nfunction main() {\n  console.log("Hello from /workspace/index.js!");\n}\n\nmain();\n`,
          },
          {
            name: "package.json",
            path: "/package.json",
            type: "file",
            language: "json",
            mimeType: "application/json",
            content: JSON.stringify(
              {
                name: defaultName,
                version: "1.0.0",
                description: description || "CloudForge project",
                main: "index.js",
                scripts: {
                  start: "node index.js",
                },
              },
              null,
              2
            ),
          },
          {
            name: "README.md",
            path: "/README.md",
            type: "file",
            language: "markdown",
            mimeType: "text/markdown",
            content: `# ${name}\n\n${description || "Created on CloudForge Cloud Development Workspace."}\n\n## Getting Started\n\nRun the application in the terminal:\n\`\`\`bash\nnode index.js\n\`\`\`\n`,
          },
        ];
        break;
    }

    for (const item of starterFiles) {
      await ProjectFile.create({
        projectId: project._id,
        name: item.name,
        path: item.path,
        type: item.type,
        language: item.language,
        mimeType: item.mimeType,
        content: item.content,
        size: Buffer.byteLength(item.content, "utf8"),
      });
    }

    // Immediately sync starter files to disk workspace
    await containerService.syncFilesToWorkspace(project._id);

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create project",
      error: error.message,
    });
  }
};

export const getProjects = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const projects = await Project.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      projects,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch projects",
      error: error.message,
    });
  }
};

export const getProject = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const project = await Project.findOne({
      _id: req.params.id,
      $or: [{ owner: userId }, { collaborators: userId }],
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    res.status(200).json({
      project,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch project",
      error: error.message,
    });
  }
};

export const getCollaborators = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const project = await Project.findOne({
      _id: req.params.id,
      $or: [{ owner: userId }, { collaborators: userId }],
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      owner: project.owner,
      collaborators: project.collaborators || [],
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch collaborators", error: error.message });
  }
};

export const addCollaborator = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      owner: userId,
    });

    if (!project) {
      return res.status(403).json({ message: "Only the project owner can add collaborators" });
    }

    const targetUser = await User.findOne({ email: email.trim().toLowerCase() }).select("_id name email");
    if (!targetUser) {
      return res.status(404).json({ message: `No user found with email "${email}"` });
    }

    if (targetUser._id.equals(project.owner)) {
      return res.status(400).json({ message: "Owner is already a member of this project" });
    }

    if (project.collaborators.some((c) => c.equals(targetUser._id))) {
      return res.status(409).json({ message: "User is already a collaborator on this project" });
    }

    project.collaborators.push(targetUser._id);
    await project.save();

    res.status(200).json({
      message: `Added ${targetUser.name || targetUser.email} as collaborator`,
      collaborator: targetUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add collaborator", error: error.message });
  }
};

export const removeCollaborator = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const targetUserId = req.params.userId;

    const project = await Project.findOne({
      _id: req.params.id,
      owner: userId,
    });

    if (!project) {
      return res.status(403).json({ message: "Only the project owner can remove collaborators" });
    }

    project.collaborators = project.collaborators.filter(
      (c) => c.toString() !== targetUserId
    );
    await project.save();

    res.status(200).json({ message: "Collaborator removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove collaborator", error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { name, description, envVariables } = req.body;
    const userId = req.user._id || req.user.id;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (envVariables !== undefined) updateFields.envVariables = envVariables;

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: userId,
      },
      updateFields,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    res.status(200).json({
      message: "Project updated successfully",
      project,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update project",
      error: error.message,
    });
  }
};

export const getProjectEnv = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const project = await Project.findOne({
      _id: req.params.id,
      owner: userId,
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      envVariables: project.envVariables || [],
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch environment variables",
      error: error.message,
    });
  }
};

export const updateProjectEnv = async (req, res) => {
  try {
    const { envVariables } = req.body;

    if (!Array.isArray(envVariables)) {
      return res.status(400).json({ message: "envVariables must be an array" });
    }

    const userId = req.user._id || req.user.id;

    const cleanVars = envVariables
      .filter((v) => v && typeof v.key === "string" && v.key.trim().length > 0)
      .map((v) => ({
        key: v.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        value: String(v.value !== undefined && v.value !== null ? v.value : ""),
      }));

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: userId,
      },
      { $set: { envVariables: cleanVars } },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Environment variables updated successfully",
      envVariables: project.envVariables || [],
      project,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update environment variables",
      error: error.message,
    });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: userId,
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Automatically clean up associated Docker container and workspace directory
    try {
      await containerService.deleteProjectContainer(req.params.id);
    } catch (cleanupErr) {
      console.warn(`Container cleanup error on project deletion (${req.params.id}):`, cleanupErr.message);
    }

    res.status(200).json({
      message: "Project deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete project",
      error: error.message,
    });
  }
};