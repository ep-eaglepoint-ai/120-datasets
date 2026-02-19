import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import ChaoticComponent from "./ChaoticComponent";
import "./style.css";

function App() {
  const [activeMode, setActiveMode] = useState("full");

  // Mock data for Alpha
  const alphaData = [
    {
      id: 101,
      status: "Active",
      priority: "High",
      user: "Admin",
      _internal: "hidden",
    },
    { id: 102, status: "Pending", priority: "Low", user: "Guest" },
  ];

  // Mock data for Beta (Tree)
  const treeItems = [
    {
      id: 1,
      label: "System Core",
      children: [
        {
          id: 2,
          label: "Sub-Module A",
          children: [{ id: 3, label: "Node.js Environment" }],
        },
        { id: 4, label: "Sub-Module B" },
      ],
    },
    {
      id: 5,
      label: "Cloud Services",
      children: [{ id: 6, label: "AWS Lambda" }],
    },
  ];

  // Mock data for Delta (Form)
  const formSchema = {
    profile: {
      type: "group",
      label: "User Profile",
      fields: {
        username: {
          type: "text",
          label: "Username",
          placeholder: "e.g. johndoe",
        },
        email: { type: "email", label: "Email Address" },
        age: { type: "number", label: "Age" },
      },
    },
    notifications: { type: "checkbox", label: "Enable Notifications" },
  };

  const formValidators = {
    "profile.username": (val) => (val && val.length < 3 ? "Too short" : true),
    "profile.email": (val) => (!val?.includes("@") ? "Invalid email" : true),
  };

  // Mock data for Gamma (Pipeline)
  const pipelineSource = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const filterFn = (x) => x % 2 === 0;
  const mapperFn = (x) => x * 10;
  const reducerFn = (acc, x) => acc + x;

  return (
    <div className="min-h-screen bg-gray-200 p-4 md:p-8 font-sans antialiased text-gray-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation / Mode Switcher */}
        <div className="flex flex-wrap gap-2 p-1 bg-white rounded-xl shadow-sm border border-gray-100">
          {["full", "alpha", "beta", "gamma", "delta", "mixed"].map((m) => (
            <button
              key={m}
              onClick={() => setActiveMode(m)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeMode === m
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-400 hover:bg-gray-50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <ChaoticComponent
          mode={activeMode}
          data={alphaData}
          items={treeItems}
          schema={formSchema}
          validators={formValidators}
          source={pipelineSource}
          filter={filterFn}
          mapper={mapperFn}
          reducer={reducerFn}
          initialValue={0}
          settings={{ dark: false, theme: "premium" }}
          onUpdate={(idx, sIdx) =>
            console.log(`Alpha update: Node ${idx} Item ${sIdx}`)
          }
          onChange={(data) => console.log("Form updated:", data)}
          onResult={(res) => console.log("Pipeline finished:", res)}
        >
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h4 className="text-sm font-bold text-indigo-900 mb-1">
              Collaborative Feedback
            </h4>
            <p className="text-xs text-indigo-700 leading-relaxed">
              This children block is rendered inside the Chaotic Controller. The
              current mode is effectively filtering which internal sub-systems
              are currently active.
            </p>
          </div>
        </ChaoticComponent>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
