import { test, expect } from "@playwright/test";

/**
 * Authorization for the three user groups, exercised as an anonymous visitor.
 * Signed-in paths (regular / privileged / admin) require the OAuth providers and
 * are covered by lib/authz unit behavior; here we lock down the anonymous edges.
 */
test.describe("Authorization (anonymous)", () => {
  test("lists only public content", async ({ request }) => {
    const res = await request.get("/api/content");
    expect(res.status()).toBe(200);
    const { items } = await res.json();
    const slugs = items.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain("hello-public");
    expect(slugs).not.toContain("secret-plan");
  });

  test("can read a public item", async ({ request }) => {
    const res = await request.get("/api/content/hello-public");
    expect(res.status()).toBe(200);
  });

  test("restricted item returns 404, not 403 (existence hidden)", async ({
    request,
  }) => {
    const res = await request.get("/api/content/secret-plan");
    expect(res.status()).toBe(404);
  });

  test("cannot create content", async ({ request }) => {
    const res = await request.post("/api/content", {
      data: { slug: "nope", title: "Nope", body: "", visibility: "public" },
    });
    expect(res.status()).toBe(403);
  });

  test("cannot use the chat", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { message: "hi" },
    });
    expect(res.status()).toBe(401);
  });

  test("restricted page redirects anonymous visitor to sign in", async ({
    page,
  }) => {
    await page.goto("/content/secret-plan");
    await expect(page).toHaveURL(/\/api\/auth\/signin/);
  });

  test("public page renders", async ({ page }) => {
    const res = await page.goto("/content/hello-public");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Hello",
    );
  });
});
