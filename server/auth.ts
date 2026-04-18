import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { Express, RequestHandler } from "express";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: string;
      partnerId: string | null;
      displayName: string | null;
    }
  }
}

export function setupAuth(app: Express) {
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "cencore-wra-2026-fallback",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid credentials" });
        const valid = await comparePasswords(password, user.password);
        if (!valid) return done(null, false, { message: "Invalid credentials" });
        return done(null, {
          id: user.id,
          username: user.username,
          role: user.role,
          partnerId: user.partnerId,
          displayName: user.displayName,
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        partnerId: user.partnerId,
        displayName: user.displayName,
      });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({
          id: user.id,
          username: user.username,
          role: user.role,
          partnerId: user.partnerId,
          displayName: user.displayName,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const user = req.user!;
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      partnerId: user.partnerId,
      displayName: user.displayName,
    });
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, firstName, lastName, email, phone, companyName, address, city, state, zipCode, country } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      if (username.length < 3) return res.status(400).json({ message: "Username must be at least 3 characters" });
      if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      if (!firstName?.trim()) return res.status(400).json({ message: "First name is required" });
      if (!lastName?.trim()) return res.status(400).json({ message: "Last name is required" });
      if (!email?.trim()) return res.status(400).json({ message: "Email is required" });
      if (!companyName?.trim()) return res.status(400).json({ message: "Company name is required" });

      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "Username already taken" });

      const hashedPassword = await hashPassword(password);
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: "partner",
        partnerId: null,
        displayName,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        companyName: companyName?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipCode: zipCode?.trim() || null,
        country: country?.trim() || null,
      });

      req.logIn({
        id: user.id,
        username: user.username,
        role: user.role,
        partnerId: user.partnerId,
        displayName: user.displayName,
      }, (err) => {
        if (err) return res.status(500).json({ message: "Registration succeeded but login failed" });
        res.status(201).json({
          id: user.id,
          username: user.username,
          role: user.role,
          partnerId: user.partnerId,
          displayName: user.displayName,
        });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Registration failed" });
    }
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Authentication required" });
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Authentication required" });
  if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
};
