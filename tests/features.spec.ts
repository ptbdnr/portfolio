import { test, expect } from "@playwright/test";

// These assume the demo content from `npm run db:seed` is present.

test.describe("Blog", () => {
  test("lists published posts and renders markdown features", async ({
    page,
  }) => {
    await page.goto("/blog");
    await expect(
      page.getByRole("heading", { name: "Blog", level: 1 })
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Vector search in production" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Vector search in production",
        level: 1,
      })
    ).toBeVisible();
    // markdown -> a table and highlighted code block rendered
    await expect(page.locator(".post-body table")).toBeVisible();
    await expect(page.locator(".post-body pre code")).toBeVisible();
  });

  test("hides drafts from the public", async ({ page }) => {
    const res = await page.goto("/blog/unpublished-idea");
    expect(res?.status()).toBe(404);
  });

  test("renders HTML-format posts but strips scripts", async ({ page }) => {
    await page.goto("/blog/styling-with-html-posts");
    await expect(page.locator(".post-body .callout")).toBeVisible();
    await expect(page.locator(".post-body script")).toHaveCount(0);
    // related post link is shown
    await expect(
      page.getByRole("link", { name: "Vector search in production" })
    ).toBeVisible();
  });
});

test.describe("Search", () => {
  test("finds a post by keyword", async ({ page }) => {
    await page.goto("/search?q=vector");
    await expect(
      page.getByRole("link", { name: "Vector search in production" })
    ).toBeVisible();
  });

  test("shows an empty state for nonsense", async ({ page }) => {
    await page.goto("/search?q=zzqqxx");
    await expect(page.getByText(/no results/i)).toBeVisible();
  });
});

test.describe("Stats", () => {
  test("shows content and visitor sections", async ({ page }) => {
    await page.goto("/stats");
    await expect(
      page.getByRole("heading", { name: "Content" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Visitors" })
    ).toBeVisible();
    await expect(page.getByText("Page views")).toBeVisible();
  });
});

test.describe("Auth + admin", () => {
  test("dev-login as admin reaches the dashboard and sees drafts", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@example.com");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Login returns to the home page; the admin then opens the dashboard.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Peter Bodnar"
    );
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();

    // Admin sees drafts on the public blog.
    await page.goto("/blog");
    await expect(page.getByText(/viewing as admin/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "An unpublished idea" })
    ).toBeVisible();
  });

  test("logged-out reader sees only published, no edit, drafts 404", async ({
    page,
  }) => {
    await page.goto("/blog");
    await expect(page.getByText(/viewing as admin/i)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "An unpublished idea" })
    ).toHaveCount(0);

    const draft = await page.goto("/blog/unpublished-idea");
    expect(draft?.status()).toBe(404);

    // /admin redirects an anonymous visitor to /login.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Share + id permalink", () => {
  test("/b/<id> resolves to the post and shows a share button", async ({
    page,
  }) => {
    await page.goto("/b/1");
    await expect(page).toHaveURL(/\/blog\/vector-search-in-production$/);
    await expect(page.getByRole("button", { name: /share/i })).toBeVisible();
  });
});

test.describe("Chat", () => {
  test("requires sign-in before sending (bot filter)", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Ask me anything" })
    ).toBeVisible();
    await page.getByRole("button", { name: "What does Peter do?" }).click();
    await expect(page.getByText(/please sign in to chat/i)).toBeVisible();
    // No message was sent — no assistant/user bubbles appeared.
    await expect(page.locator("#chat .whitespace-pre-wrap")).toHaveCount(0);
  });

  test("any signed-in user can send (degrades without an LLM key)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "reader@example.com"); // not an admin
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Peter Bodnar"
    );
    await page.getByRole("button", { name: "What does Peter do?" }).click();
    await expect(
      page.locator("#chat .whitespace-pre-wrap").last()
    ).not.toBeEmpty({ timeout: 20000 });
  });
});
