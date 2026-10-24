export const authFetch = (url: string, options: any = {}) => {
  const token = localStorage.getItem("access");

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getCandidates = async () => {
  return [
    {
      id: 1,
      name: "Anish Singh",
      email: "anish@email.com",
      role: "Python Developer",
      score: 92,
      status: "Shortlisted",
      skills: "Django, FastAPI, SQL",
    },
  ];
};

export const uploadResume = async (file: File, jobDesc: string) => {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("job_description", jobDesc);

  const res = await fetch("https://anish321-ats-resume-analyzer.hf.space/api/upload-resume/", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to analyze resume");
  }

  return res.json();
};