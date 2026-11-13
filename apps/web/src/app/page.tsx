"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../context/UserContext";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/chat");
    } else {
      router.replace("/register");
    }
  }, [user, loading, router]);

  return null;
}
