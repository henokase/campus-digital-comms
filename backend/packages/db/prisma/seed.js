const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function isoDaysAgo(daysAgo, hoursAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d;
}

function stableUuid(prefix, n) {
  // Creates stable UUID-like values for deterministic seeds.
  // Not cryptographically random; for dev-only seeds.
  const suffix = String(100000000000 + n).slice(-12);
  return `${prefix}-0000-4000-8000-${suffix}`;
}

async function main() {
  // -----------------------------
  // 1) Clear existing data
  // -----------------------------
  try {
    await prisma.notificationProcessedEvent.deleteMany();
    await prisma.processedEvent.deleteMany();
    await prisma.feedback.deleteMany();
    await prisma.announcementMetrics.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.user.deleteMany();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('postgres:5432') || message.includes("Can't reach database server")) {
      console.error('Database connection failed for seeding.')
      console.error('If you are running this from your host terminal, DATABASE_URL must point to localhost, not the docker hostname "postgres".')
      console.error('Example: postgresql://cdcp_user:1234@localhost:5432/cdcp?schema=public')
    }
    if (message.toLowerCase().includes('authentication failed')) {
      console.error('Database authentication failed for seeding.')
      console.error('This usually means the username/password in DATABASE_URL do not match the running Postgres instance.')
      console.error('Check backend/packages/db/.env (or your shell DATABASE_URL) and update credentials to match your database.')
      console.error('If you want to use Docker Compose defaults, start Postgres via docker compose and use:')
      console.error('postgresql://cdcp_user:1234@localhost:5432/cdcp?schema=public')
    }
    throw err
  }

  // -----------------------------
  // 2) Users
  // -----------------------------
  const departments = {
    software: 'Software',
    cs: 'Computer Science',
  };

  const passwordPlain = 'Password123!';
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const adminId = '0f1f7d8c-6d2c-4c9b-9c74-95a3e3d774a1';
  const facultySoftwareId = '7cc6b8b3-85b9-4a0e-9c4d-5d728f5aefc1';
  const facultyCsId = 'b27c83d7-1b95-4b9c-8e9e-bc1e2f6e7d3f';

  const users = [
    {
      id: adminId,
      email: 'admin@cdcp.edu',
      passwordHash,
      role: 'admin',
      fullName: 'System Admin',
      department: null,
      year: null,
      createdAt: isoDaysAgo(365),
    },
    {
      id: facultySoftwareId,
      email: 'faculty.software@cdcp.edu',
      passwordHash,
      role: 'faculty',
      fullName: 'Dr. Hana Bekele',
      department: departments.software,
      year: null,
      createdAt: isoDaysAgo(180),
    },
    {
      id: facultyCsId,
      email: 'faculty.cs@cdcp.edu',
      passwordHash,
      role: 'faculty',
      fullName: 'Dr. Samuel Tadesse',
      department: departments.cs,
      year: null,
      createdAt: isoDaysAgo(170),
    },
  ];

  const students = [];
  for (let i = 0; i < 10; i += 1) {
    const isSoftware = i < 5;
    const dept = isSoftware ? departments.software : departments.cs;
    const year = (i % 4) + 1;
    const idx = i + 1;
    students.push({
      id: stableUuid('33333333', idx),
      email: `student${idx}@cdcp.edu`,
      passwordHash,
      role: 'student',
      fullName: isSoftware ? `Software Student ${idx}` : `CS Student ${idx}`,
      department: dept,
      year,
      createdAt: isoDaysAgo(90 - i),
    });
  }

  await prisma.user.createMany({ data: [...users, ...students] });

  // -----------------------------
  // 3) Announcements (6)
  // -----------------------------
  const announcements = [
    {
      id: stableUuid('00000000', 1),
      title: 'Final Exam Timetable Released (Software & CS)',
      content:
        'The Registrar has published the final exam timetable for Software Engineering and Computer Science.\n\n' +
        'Please check your department notice board and confirm there are no clashes in your schedule. If you identify any conflict, report it to your department office no later than Friday 4:00 PM.\n\n' +
        'Tip: arrive at least 15 minutes early and bring your student ID.',
      type: 'exam',
      category: 'Academic',
      priority: 'high',
      createdBy: facultySoftwareId,
      targetAudience: { roles: ['student'], departments: [departments.software, departments.cs] },
      status: 'published',
      publishedAt: isoDaysAgo(7, 2),
      createdAt: isoDaysAgo(9, 1),
    },
    {
      id: stableUuid('00000000', 2),
      title: 'Workshop: Git & Professional Team Workflow (Software Dept)',
      content:
        'Software Engineering students are invited to a hands-on workshop on Git collaboration workflows.\n\n' +
        'Topics include: branching strategies, pull requests, code reviews, and resolving conflicts.\n\n' +
        'Venue: Lab 2\nDate: Wednesday\nTime: 2:00 PM - 5:00 PM\n\n' +
        'Seats are limited. Please register with the department secretary.',
      type: 'event',
      category: 'Event',
      priority: 'medium',
      createdBy: facultySoftwareId,
      targetAudience: { roles: ['student'], departments: [departments.software] },
      status: 'published',
      publishedAt: isoDaysAgo(5, 4),
      createdAt: isoDaysAgo(6, 6),
    },
    {
      id: stableUuid('00000000', 3),
      title: 'CS Department: Project Proposal Submission Reminder',
      content:
        'Computer Science students: project proposal submissions close this Sunday at 11:59 PM.\n\n' +
        'Ensure your proposal includes: title, problem statement, objective, methodology, and timeline.\n\n' +
        'Submissions will be reviewed next week and feedback will be provided through your advisors.',
      type: 'administrative',
      category: 'Academic',
      priority: 'high',
      createdBy: facultyCsId,
      targetAudience: { roles: ['student'], departments: [departments.cs] },
      status: 'published',
      publishedAt: isoDaysAgo(3, 3),
      createdAt: isoDaysAgo(4, 2),
    },
    {
      id: stableUuid('00000000', 4),
      title: 'Campus Network Maintenance Notice',
      content:
        'IT Services will perform scheduled maintenance on the campus network.\n\n' +
        'Expected impact: intermittent Wi-Fi connectivity in the library and main lecture halls.\n' +
        'Maintenance window: Saturday 8:00 AM - 2:00 PM.\n\n' +
        'We apologize for the inconvenience and recommend downloading any required materials in advance.',
      type: 'general',
      category: 'Administrative',
      priority: 'medium',
      createdBy: adminId,
      targetAudience: { roles: ['student', 'faculty', 'admin'] },
      status: 'published',
      publishedAt: isoDaysAgo(2, 8),
      createdAt: isoDaysAgo(3, 10),
    },
    {
      id: stableUuid('00000000', 5),
      title: 'Library Extended Hours During Exams',
      content:
        'The main library will extend opening hours during the exam period.\n\n' +
        'New hours: 6:30 AM - 11:00 PM (daily) from next Monday until the end of exams.\n\n' +
        'Please maintain a quiet study environment and keep your ID available for late entry.',
      type: 'general',
      category: 'General',
      priority: 'low',
      createdBy: adminId,
      targetAudience: { roles: ['student'] },
      status: 'published',
      publishedAt: isoDaysAgo(1, 6),
      createdAt: isoDaysAgo(2, 12),
    },
    {
      id: stableUuid('00000000', 6),
      title: 'Faculty Office Hours Updated (Software & CS)',
      content:
        'Faculty office hours have been updated for the remainder of the semester.\n\n' +
        '- Software Dept: Tue & Thu, 10:00 AM - 12:00 PM\n' +
        '- CS Dept: Mon & Wed, 1:30 PM - 3:30 PM\n\n' +
        'Students are encouraged to book appointments in advance for project consultations.',
      type: 'administrative',
      category: 'Administrative',
      priority: 'medium',
      createdBy: facultyCsId,
      targetAudience: { roles: ['student'], departments: [departments.software, departments.cs] },
      status: 'published',
      publishedAt: isoDaysAgo(0, 3),
      createdAt: isoDaysAgo(1, 1),
    },
  ];

  await prisma.announcement.createMany({
    data: announcements.map((a) => ({
      ...a,
      updatedAt: a.createdAt,
    })),
  });

  // -----------------------------
  // 4) Notifications + idempotency ledger
  // -----------------------------
  const inScopeStudentsForAnnouncement = (announcement) => {
    const ta = announcement.targetAudience || {};
    const roles = Array.isArray(ta.roles) ? ta.roles : [];
    const deps = Array.isArray(ta.departments) ? ta.departments : null;

    return students.filter((s) => {
      if (roles.length > 0 && !roles.includes(s.role)) return false;
      if (deps && deps.length > 0) {
        return deps.includes(s.department);
      }
      return true;
    });
  };

  const notifications = [];
  const notificationProcessedEvents = [];
  const processedEvents = [];

  for (let i = 0; i < announcements.length; i += 1) {
    const a = announcements[i];
    const eventId = stableUuid('99999999', i + 1);
    const eventType = 'announcement.published';

    processedEvents.push({
      eventId,
      eventType,
      processedAt: a.publishedAt || isoDaysAgo(1),
    });

    // Notification service idempotency table (seeded for realism)
    notificationProcessedEvents.push({
      eventId,
      eventType,
      processedAt: a.publishedAt || isoDaysAgo(1),
    });

    const recipients = inScopeStudentsForAnnouncement(a);

    for (let j = 0; j < recipients.length; j += 1) {
      const u = recipients[j];
      const read = (j + i) % 3 === 0;
      const sentAt = a.publishedAt || isoDaysAgo(1);
      const readAt = read ? isoDaysAgo(Math.max(0, i % 2), 1) : null;

      notifications.push({
        id: stableUuid('11111111', i * 100 + j + 1),
        announcementId: a.id,
        userId: u.id,
        channel: 'in_app',
        sourceEventId: eventId,
        status: 'sent',
        sentAt,
        readAt,
        errorMessage: null,
        createdAt: sentAt,
        updatedAt: readAt || sentAt,
      });
    }
  }

  await prisma.processedEvent.createMany({ data: processedEvents });
  await prisma.notificationProcessedEvent.createMany({ data: notificationProcessedEvents });
  await prisma.notification.createMany({ data: notifications });

  // -----------------------------
  // 5) Feedback (every student per announcement)
  // -----------------------------
  const reactions = ['positive', 'neutral', 'negative', 'question'];

  const feedback = [];
  for (let i = 0; i < announcements.length; i += 1) {
    const a = announcements[i];
    const recipients = inScopeStudentsForAnnouncement(a);

    for (let j = 0; j < recipients.length; j += 1) {
      const u = recipients[j];
      const idx = i * 100 + j + 1;
      const reactionType = reactions[idx % reactions.length];
      const rating = (idx % 5) === 0 ? null : ((idx % 5) + 1);
      const isAnonymous = (idx % 4) === 0;
      const createdAt = isoDaysAgo(Math.max(0, 6 - i), j % 6);

      const comment = (() => {
        if (reactionType === 'positive') {
          return 'Clear and helpful. Thanks for sharing the details early.';
        }
        if (reactionType === 'neutral') {
          return "Noted. I'll plan accordingly.";
        }
        if (reactionType === 'negative') {
          return 'This timing is difficult for me. Is there an alternative option?';
        }
        return 'Could you clarify the exact deadline and where we should submit?';
      })();

      feedback.push({
        id: stableUuid('22222222', idx),
        announcementId: a.id,
        userId: u.id,
        reactionType,
        comment,
        rating,
        isAnonymous,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  await prisma.feedback.createMany({ data: feedback });

  // -----------------------------
  // 6) AnnouncementMetrics (consistent totals)
  // -----------------------------
  const metrics = announcements.map((a) => {
    const sent = notifications.filter((n) => n.announcementId === a.id).length;
    const read = notifications.filter((n) => n.announcementId === a.id && n.readAt).length;
    const fb = feedback.filter((f) => f.announcementId === a.id).length;

    return {
      announcementId: a.id,
      notificationsSent: sent,
      notificationsRead: read,
      feedbackCount: fb,
      lastUpdatedAt: new Date(),
    };
  });

  await prisma.announcementMetrics.createMany({ data: metrics });

  console.log('Seed complete.');
  console.log(`Seeded users: ${users.length + students.length}`);
  console.log(`Seeded announcements: ${announcements.length}`);
  console.log(`Seeded notifications: ${notifications.length}`);
  console.log(`Seeded feedback: ${feedback.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
