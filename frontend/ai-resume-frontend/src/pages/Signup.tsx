// src/pages/Signup.tsx
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Check,
  ArrowRight,
  UserPlus,
  Upload,
  LayoutGrid,
} from "lucide-react";

const REGISTER_URL = "https://anish321-ats-resume-analyzer.hf.space/api/register/";

type Fields = "username" | "email" | "password" | "confirm";
type Errors = Partial<Record<Fields | "form", string>>;

const STEPS = [
  { icon: UserPlus, title: "Create your account", text: "It takes less than a minute." },
  { icon: Upload, title: "Upload resumes", text: "Add resumes and a job description." },
  { icon: LayoutGrid, title: "Get ranked results", text: "See scores, skill gaps and tips." },
];

// Backend returns {"field": ["message", ...]} on 400. Pull the first message per field.
const parseServerErrors = (data: any): Errors => {
  const out: Errors = {};
  if (!data || typeof data !== "object") return out;
  (["username", "email", "password"] as const).forEach((f) => {
    const v = data[f];
    if (Array.isArray(v) && v.length) out[f] = v.join(" ");
    else if (typeof v === "string") out[f] = v;
  });
  const other = data.error || data.detail || data.non_field_errors;
  if (other) out.form = Array.isArray(other) ? other.join(" ") : String(other);
  return out;
};

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const set = (key: Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key] || errors.form) setErrors((er) => ({ ...er, [key]: undefined, form: undefined }));
  };

  // Password rules shown as a live checklist
  const rules = useMemo(() => {
    const p = form.password;
    return [
      { label: "At least 8 characters", ok: p.length >= 8 },
      { label: "Not only numbers", ok: p.length > 0 && !/^\d+$/.test(p) },
      { label: "Contains a letter and a number", ok: /[A-Za-z]/.test(p) && /\d/.test(p) },
    ];
  }, [form.password]);

  const strength = useMemo(() => {
    const p = form.password;
    if (!p) return 0;
    const passed = rules.filter((r) => r.ok).length;
    const bonus = p.length >= 12 || /[^A-Za-z0-9]/.test(p) ? 1 : 0;
    return Math.min(4, passed + bonus); // 0..4
  }, [form.password, rules]);

  const strengthMeta = [
    { label: "", bar: "bg-gray-200", text: "text-gray-400" },
    { label: "Weak", bar: "bg-red-500", text: "text-red-600" },
    { label: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
    { label: "Good", bar: "bg-green-500", text: "text-green-600" },
    { label: "Strong", bar: "bg-emerald-600", text: "text-emerald-700" },
  ][strength];

  const validate = (): Errors => {
    const e: Errors = {};
    const u = form.username.trim();
    if (u.length < 3) e.username = "Username must be at least 3 characters.";
    else if (!/^[\w.@+-]+$/.test(u))
      e.username = "Use only letters, numbers and @ . + - _ (no spaces).";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (!rules.every((r) => r.ok)) e.password = "Password does not meet all the requirements.";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (loading) return;

    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const serverErrors = parseServerErrors(data);
        if (!Object.keys(serverErrors).length) serverErrors.form = "Signup failed. Please try again.";
        setErrors(serverErrors);
        toast.error("Please fix the highlighted fields.");
        return;
      }

      try {
        localStorage.setItem("remembered_username", form.username.trim());
      } catch {
        /* storage unavailable */
      }
      toast.success("Account created! Please log in.");
      navigate("/login");
    } catch (err) {
      console.error(err);
      setErrors({
        form: "Could not reach the server. It may be waking up, please wait a few seconds and try again.",
      });
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-xl border bg-white py-3 pl-11 text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-4 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
        : "border-gray-300 focus:border-green-600 focus:ring-green-100"
    }`;

  const iconClass =
    "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400";

  const FieldError = ({ id, msg }: { id: string; msg?: string }) =>
    msg ? (
      <p id={id} className="mt-1.5 text-xs font-medium text-red-600">
        {msg}
      </p>
    ) : null;

  const matchOk = form.confirm.length > 0 && form.confirm === form.password;

  return (
    <div className="grid min-h-[calc(100vh-67px)] lg:grid-cols-2">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-700 via-green-600 to-green-600 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-black/10" />

        <div className="relative max-w-md">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-100">
            Join for free
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight xl:text-5xl">
            Screen smarter.
            <br />
            Hire faster.
          </h2>
          <p className="mt-4 text-green-50">
            Create an account to score resumes against any job description and keep every
            session in your own dashboard.
          </p>

          <ol className="mt-10 space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-4">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <s.icon size={20} />
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-green-700">
                    {i + 1}
                  </span>
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-green-100">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="flex items-center justify-center bg-gray-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-gray-100 sm:p-10">
            <div className="mb-7 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                <UserPlus size={26} />
              </span>
              <h1 className="text-3xl font-bold text-gray-900">Create account</h1>
              <p className="mt-2 text-gray-500">Start screening resumes in minutes</p>
            </div>

            {errors.form && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Username */}
              <div>
                <label htmlFor="su-username" className="mb-2 block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="relative">
                  <User size={18} className={iconClass} />
                  <input
                    id="su-username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Choose a username"
                    value={form.username}
                    onChange={set("username")}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "su-username-err" : undefined}
                    className={`${inputClass(!!errors.username)} pr-4`}
                  />
                </div>
                <FieldError id="su-username-err" msg={errors.username} />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="su-email" className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="relative">
                  <Mail size={18} className={iconClass} />
                  <input
                    id="su-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set("email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "su-email-err" : undefined}
                    className={`${inputClass(!!errors.email)} pr-4`}
                  />
                </div>
                <FieldError id="su-email-err" msg={errors.email} />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="su-password" className="mb-2 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className={iconClass} />
                  <input
                    id="su-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={form.password}
                    onChange={set("password")}
                    onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                    onKeyDown={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                    aria-invalid={!!errors.password}
                    aria-describedby="su-password-help"
                    className={`${inputClass(!!errors.password)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {capsOn && <p className="mt-2 text-xs font-medium text-amber-600">Caps Lock is on</p>}

                {/* strength meter */}
                {form.password && (
                  <div className="mt-3">
                    <div className="flex gap-1.5" aria-hidden="true">
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strength ? strengthMeta.bar : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`mt-1 text-xs font-semibold ${strengthMeta.text}`}>
                      Password strength: {strengthMeta.label}
                    </p>
                  </div>
                )}

                <ul id="su-password-help" className="mt-3 space-y-1">
                  {rules.map((r) => (
                    <li
                      key={r.label}
                      className={`flex items-center gap-2 text-xs ${
                        r.ok ? "text-green-700" : "text-gray-500"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                          r.ok ? "bg-green-600 text-white" : "bg-gray-200 text-transparent"
                        }`}
                      >
                        <Check size={11} strokeWidth={3} />
                      </span>
                      {r.label}
                    </li>
                  ))}
                </ul>
                <FieldError id="su-password-err" msg={errors.password} />
              </div>

              {/* Confirm */}
              <div>
                <label htmlFor="su-confirm" className="mb-2 block text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock size={18} className={iconClass} />
                  <input
                    id="su-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={form.confirm}
                    onChange={set("confirm")}
                    aria-invalid={!!errors.confirm}
                    aria-describedby={errors.confirm ? "su-confirm-err" : undefined}
                    className={`${inputClass(!!errors.confirm)} pr-4`}
                  />
                </div>
                {matchOk && !errors.confirm && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-700">
                    <Check size={13} strokeWidth={3} /> Passwords match
                  </p>
                )}
                <FieldError id="su-confirm-err" msg={errors.confirm} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    Create account <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              Already a member?
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              to="/login"
              className="block w-full rounded-xl border border-green-600 py-3 text-center font-semibold text-green-700 transition hover:bg-green-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-100"
            >
              Sign in instead
            </Link>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <ShieldCheck size={14} className="text-green-600" />
              Your resumes stay private to your account.
            </p>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            <Link to="/" className="font-medium text-green-700 hover:underline">
              &larr; Back to home
            </Link>
            <span className="mx-2 text-gray-300">|</span>
            <Link to="/about" className="font-medium text-green-700 hover:underline">
              About the project
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
