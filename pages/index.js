export async function getServerSideProps(context) {
  const { shop, host } = context.query;

  if (shop && host) {
    return {
      redirect: {
        destination: `/dashboard?shop=${shop}&host=${host}`,
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}

export default function Index() {
  return <p>Redirecting...</p>;
}